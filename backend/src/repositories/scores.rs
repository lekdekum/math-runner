use chrono::Utc;
use diesel::RunQueryDsl;
use uuid::Uuid;

use crate::{
    errors::AppError,
    models::score::{NewScore, Score},
    schema::scores,
};

pub struct ScoreRepository;

impl ScoreRepository {
    pub fn new() -> Self {
        Self
    }

    pub fn insert(
        &self,
        connection: &mut diesel::PgConnection,
        name_value: &str,
        score_value: i32,
        slug_value: &str,
    ) -> Result<Score, AppError> {
        let new_score = NewScore {
            id: Uuid::new_v4(),
            name: name_value.to_string(),
            score: score_value,
            slug: slug_value.to_string(),
            created_at: Utc::now().naive_utc(),
        };

        diesel::insert_into(scores::table)
            .values(&new_score)
            .get_result(connection)
            .map_err(|error| AppError::Internal(format!("database operation failed: {error}")))
    }
}
