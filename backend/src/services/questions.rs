use std::io::Cursor;

use csv::{ReaderBuilder, StringRecord, Trim};
use serde_json::{Number, Value};
use tokio::task;

use crate::{
    db::DbPool,
    errors::AppError,
    models::question::{CsvQuestion, CsvQuestionsResponse, QuestionListResponse, QuestionResponse},
    repositories::questions::QuestionRepository,
};

#[derive(Clone)]
pub struct QuestionService {
    pool: DbPool,
}

impl QuestionService {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &DbPool {
        &self.pool
    }

    pub fn normalize_slug(&self, slug: String) -> Result<String, AppError> {
        normalize_slug(slug)
    }

    pub async fn create_question(
        &self,
        question_slug: String,
        question_name: Option<String>,
        payload: Value,
    ) -> Result<QuestionResponse, AppError> {
        let slug = normalize_slug(question_slug)?;
        let name = question_name.unwrap_or_else(|| slug.clone());
        let pool = self.pool.clone();

        task::spawn_blocking(move || {
            let mut connection = pool.get().map_err(|error| {
                AppError::Internal(format!("failed to get database connection: {error}"))
            })?;

            let repository = QuestionRepository::new();

            if repository.find_by_slug(&mut connection, &slug)?.is_some() {
                return Err(AppError::Conflict(format!(
                    "question slug '{slug}' already exists"
                )));
            }

            let question = repository.insert(&mut connection, &slug, &name, payload)?;
            Ok(question.into())
        })
        .await
        .map_err(|error| AppError::Internal(format!("blocking task failed: {error}")))?
    }

    pub async fn get_question(&self, question_slug: String) -> Result<QuestionResponse, AppError> {
        let slug = normalize_slug(question_slug)?;
        let pool = self.pool.clone();

        task::spawn_blocking(move || {
            let mut connection = pool.get().map_err(|error| {
                AppError::Internal(format!("failed to get database connection: {error}"))
            })?;

            let repository = QuestionRepository::new();
            let question = repository
                .find_by_slug(&mut connection, &slug)?
                .ok_or_else(|| {
                    AppError::NotFound(format!("question slug '{slug}' was not found"))
                })?;

            Ok(question.into())
        })
        .await
        .map_err(|error| AppError::Internal(format!("blocking task failed: {error}")))?
    }

    pub async fn import_questions_csv(
        &self,
        question_slug: String,
        question_name: Option<String>,
        bytes: Vec<u8>,
    ) -> Result<QuestionResponse, AppError> {
        let slug = normalize_slug(question_slug)?;
        let payload = task::spawn_blocking(move || {
            parse_questions_csv(&bytes).map(|response| {
                serde_json::to_value(response)
                    .expect("csv questions response should serialize to JSON")
            })
        })
        .await
        .map_err(|error| AppError::Internal(format!("blocking task failed: {error}")))??;

        self.create_question(slug, question_name, payload).await
    }

    pub async fn list_questions(&self) -> Result<QuestionListResponse, AppError> {
        let pool = self.pool.clone();

        task::spawn_blocking(move || {
            let mut connection = pool.get().map_err(|error| {
                AppError::Internal(format!("failed to get database connection: {error}"))
            })?;

            let repository = QuestionRepository::new();
            let questions = repository.list_summaries(&mut connection)?;
            let slugs = questions.iter().map(|question| question.slug.clone()).collect();

            Ok(QuestionListResponse { questions, slugs })
        })
        .await
        .map_err(|error| AppError::Internal(format!("blocking task failed: {error}")))?
    }
}

fn normalize_slug(slug: String) -> Result<String, AppError> {
    let trimmed = slug.trim();

    if trimmed.is_empty() {
        return Err(AppError::BadRequest(
            "question slug must not be empty".to_string(),
        ));
    }

    if !trimmed
        .chars()
        .all(|char| char.is_ascii_alphanumeric() || char == '-' || char == '_')
    {
        return Err(AppError::BadRequest(
            "question slug must contain only letters, numbers, '-' or '_'".to_string(),
        ));
    }

    Ok(trimmed.to_string())
}

fn parse_questions_csv(bytes: &[u8]) -> Result<CsvQuestionsResponse, AppError> {
    if bytes.is_empty() {
        return Err(AppError::BadRequest(
            "uploaded CSV file is empty".to_string(),
        ));
    }

    let delimiter = detect_delimiter(bytes);
    let mut reader = ReaderBuilder::new()
        .delimiter(delimiter)
        .flexible(true)
        .trim(Trim::All)
        .from_reader(Cursor::new(bytes));

    let headers = reader
        .headers()
        .map_err(|error| AppError::BadRequest(format!("failed to parse CSV header: {error}")))?
        .clone();

    let question_index = find_question_index(&headers)?;
    let answer_indexes = find_answer_indexes(&headers, question_index)?;

    let mut questions = Vec::new();

    for record in reader.records() {
        let record = record
            .map_err(|error| AppError::BadRequest(format!("failed to parse CSV row: {error}")))?;

        if row_is_empty(&record) {
            continue;
        }

        let question = record
            .get(question_index)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                AppError::BadRequest("each CSV row must include a question".to_string())
            })?
            .to_string();

        let answers = answer_indexes
            .iter()
            .filter_map(|index| record.get(*index))
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(parse_scalar_value)
            .collect::<Vec<_>>();

        if answers.is_empty() {
            return Err(AppError::BadRequest(
                "each CSV row must include at least one answer".to_string(),
            ));
        }

        questions.push(CsvQuestion { answers, question });
    }

    if questions.is_empty() {
        return Err(AppError::BadRequest(
            "uploaded CSV file does not contain any question rows".to_string(),
        ));
    }

    Ok(CsvQuestionsResponse { questions })
}

fn detect_delimiter(bytes: &[u8]) -> u8 {
    let sample = String::from_utf8_lossy(bytes);
    let first_line = sample
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or_default();

    [b',', b';', b'\t', b'|']
        .into_iter()
        .max_by_key(|delimiter| {
            first_line
                .as_bytes()
                .iter()
                .filter(|byte| *byte == delimiter)
                .count()
        })
        .filter(|delimiter| first_line.as_bytes().contains(delimiter))
        .unwrap_or(b',')
}

fn find_question_index(headers: &StringRecord) -> Result<usize, AppError> {
    headers
        .iter()
        .position(|header| matches!(normalize_header(header).as_str(), "pergunta" | "question"))
        .ok_or_else(|| {
            AppError::BadRequest(
                "CSV header must include a 'Pergunta' or 'Question' column".to_string(),
            )
        })
}

fn find_answer_indexes(
    headers: &StringRecord,
    question_index: usize,
) -> Result<Vec<usize>, AppError> {
    let answer_indexes = headers
        .iter()
        .enumerate()
        .filter(|(index, _)| *index != question_index)
        .filter_map(|(index, header)| {
            let normalized = normalize_header(header);
            let is_answer = normalized == "respostacerta"
                || normalized.starts_with("respostaerrada")
                || normalized == "correctanswer"
                || normalized.starts_with("wronganswer")
                || normalized.starts_with("answer");

            is_answer.then_some(index)
        })
        .collect::<Vec<_>>();

    if answer_indexes.is_empty() {
        return Err(AppError::BadRequest(
            "CSV header must include at least one answer column".to_string(),
        ));
    }

    Ok(answer_indexes)
}

fn normalize_header(header: &str) -> String {
    header
        .chars()
        .filter(|char| char.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn row_is_empty(record: &StringRecord) -> bool {
    record.iter().all(|value| value.trim().is_empty())
}

fn parse_scalar_value(value: &str) -> Value {
    if let Ok(parsed) = value.parse::<i64>() {
        return Value::Number(Number::from(parsed));
    }

    if let Ok(parsed) = value.parse::<u64>() {
        return Value::Number(Number::from(parsed));
    }

    if let Ok(parsed) = value.parse::<f64>() {
        if let Some(number) = Number::from_f64(parsed) {
            return Value::Number(number);
        }
    }

    if let Ok(parsed) = value.parse::<bool>() {
        return Value::Bool(parsed);
    }

    Value::String(value.to_string())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{normalize_slug, parse_questions_csv};

    #[test]
    fn normalize_slug_rejects_blank_values() {
        let error = normalize_slug("   ".to_string()).unwrap_err();
        assert_eq!(error.to_string(), "question slug must not be empty");
    }

    #[test]
    fn normalize_slug_trims_whitespace() {
        let slug = normalize_slug("  algebra-1  ".to_string()).unwrap();
        assert_eq!(slug, "algebra-1");
    }

    #[test]
    fn normalize_slug_rejects_spaces() {
        let error = normalize_slug("algebra 1".to_string()).unwrap_err();
        assert_eq!(
            error.to_string(),
            "question slug must contain only letters, numbers, '-' or '_'"
        );
    }

    #[test]
    fn normalize_slug_rejects_special_characters() {
        let error = normalize_slug("algebra@1".to_string()).unwrap_err();
        assert_eq!(
            error.to_string(),
            "question slug must contain only letters, numbers, '-' or '_'"
        );
    }

    #[test]
    fn normalize_slug_allows_letters_numbers_hyphen_and_underscore() {
        let slug = normalize_slug("math_runner-2026".to_string()).unwrap();
        assert_eq!(slug, "math_runner-2026");
    }

    #[test]
    fn parse_questions_csv_supports_tab_delimited_uploads() {
        let csv = "Pergunta\tRespostaCerta\tRespostaErrada1\tRespostaErrada2\n\"2+2\"\t4\t6\t8\n\"3+3\"\t6\t7\t8\n";

        let response = parse_questions_csv(csv.as_bytes()).unwrap();

        assert_eq!(
            response,
            crate::models::question::CsvQuestionsResponse {
                questions: vec![
                    crate::models::question::CsvQuestion {
                        question: "2+2".to_string(),
                        answers: vec![json!(4), json!(6), json!(8)],
                    },
                    crate::models::question::CsvQuestion {
                        question: "3+3".to_string(),
                        answers: vec![json!(6), json!(7), json!(8)],
                    },
                ],
            }
        );
    }

    #[test]
    fn parse_questions_csv_supports_semicolon_delimited_uploads() {
        let csv = "Question;CorrectAnswer;WrongAnswer1;WrongAnswer2\nHow much is 2 + 2?;4;6;8\n";

        let response = parse_questions_csv(csv.as_bytes()).unwrap();

        assert_eq!(response.questions.len(), 1);
        assert_eq!(response.questions[0].question, "How much is 2 + 2?");
        assert_eq!(
            response.questions[0].answers,
            vec![json!(4), json!(6), json!(8)]
        );
    }
}
