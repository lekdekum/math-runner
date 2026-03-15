use chrono::Utc;
use diesel::{ExpressionMethods, OptionalExtension, QueryDsl, RunQueryDsl};
use serde_json::Value;
use uuid::Uuid;

use crate::{
    errors::AppError,
    models::question::{NewQuestion, Question, QuestionSummary},
    schema::questions,
};

pub struct QuestionRepository;

impl QuestionRepository {
    pub fn new() -> Self {
        Self
    }

    pub fn insert(
        &self,
        connection: &mut diesel::PgConnection,
        slug_value: &str,
        name_value: &str,
        payload_value: Value,
    ) -> Result<Question, AppError> {
        let new_question = NewQuestion {
            id: Uuid::new_v4(),
            slug: slug_value.to_string(),
            name: name_value.to_string(),
            payload: payload_value,
            created_at: Utc::now().naive_utc(),
        };

        diesel::insert_into(questions::table)
            .values(&new_question)
            .get_result(connection)
            .map_err(map_database_error)
    }

    pub fn find_by_slug(
        &self,
        connection: &mut diesel::PgConnection,
        slug_value: &str,
    ) -> Result<Option<Question>, AppError> {
        questions::table
            .filter(questions::slug.eq(slug_value))
            .first::<Question>(connection)
            .optional()
            .map_err(map_database_error)
    }

    pub fn list_slugs(
        &self,
        connection: &mut diesel::PgConnection,
    ) -> Result<Vec<String>, AppError> {
        questions::table
            .select(questions::slug)
            .order(questions::created_at.asc())
            .load::<String>(connection)
            .map_err(map_database_error)
    }

    pub fn list_summaries(
        &self,
        connection: &mut diesel::PgConnection,
    ) -> Result<Vec<QuestionSummary>, AppError> {
        questions::table
            .select((questions::slug, questions::name))
            .order(questions::created_at.asc())
            .load::<(String, String)>(connection)
            .map(|rows| {
                rows.into_iter()
                    .map(|(slug, name)| QuestionSummary { slug, name })
                    .collect()
            })
            .map_err(map_database_error)
    }
}

fn map_database_error(error: diesel::result::Error) -> AppError {
    match error {
        diesel::result::Error::NotFound => AppError::NotFound("question was not found".to_string()),
        other => AppError::Internal(format!("database operation failed: {other}")),
    }
}
