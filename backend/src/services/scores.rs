use tokio::task;

use crate::{
    errors::AppError,
    models::score::{CreateScoreRequest, ScoreResponse},
    repositories::{questions::QuestionRepository, scores::ScoreRepository},
    services::questions::QuestionService,
};

#[derive(Clone)]
pub struct ScoreService {
    question_service: QuestionService,
}

impl ScoreService {
    pub fn new(question_service: QuestionService) -> Self {
        Self { question_service }
    }

    pub async fn submit_score(
        &self,
        question_slug: String,
        payload: CreateScoreRequest,
    ) -> Result<ScoreResponse, AppError> {
        let slug = self.question_service.normalize_slug(question_slug)?;
        let name = normalize_name(payload.name)?;
        let score = normalize_score(payload.score)?;
        let pool = self.question_service.pool().clone();

        task::spawn_blocking(move || {
            let mut connection = pool.get().map_err(|error| {
                AppError::Internal(format!("failed to get database connection: {error}"))
            })?;

            let question_repository = QuestionRepository::new();
            question_repository
                .find_by_slug(&mut connection, &slug)?
                .ok_or_else(|| {
                    AppError::NotFound(format!("question slug '{slug}' was not found"))
                })?;

            let score_repository = ScoreRepository::new();
            let score = score_repository.insert(&mut connection, &name, score, &slug)?;

            Ok(score.into())
        })
        .await
        .map_err(|error| AppError::Internal(format!("blocking task failed: {error}")))?
    }
}

fn normalize_name(name: String) -> Result<String, AppError> {
    let trimmed = name.trim();

    if trimmed.is_empty() {
        return Err(AppError::BadRequest("name must not be empty".to_string()));
    }

    Ok(trimmed.to_string())
}

fn normalize_score(score: i32) -> Result<i32, AppError> {
    if score < 0 {
        return Err(AppError::BadRequest(
            "score must not be negative".to_string(),
        ));
    }

    Ok(score)
}

#[cfg(test)]
mod tests {
    use super::{normalize_name, normalize_score};

    #[test]
    fn normalize_name_rejects_blank_values() {
        let error = normalize_name("   ".to_string()).unwrap_err();
        assert_eq!(error.to_string(), "name must not be empty");
    }

    #[test]
    fn normalize_score_rejects_negative_values() {
        let error = normalize_score(-1).unwrap_err();
        assert_eq!(error.to_string(), "score must not be negative");
    }
}
