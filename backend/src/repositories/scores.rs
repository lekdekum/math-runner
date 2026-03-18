use chrono::Utc;
use diesel::{ExpressionMethods, QueryDsl, RunQueryDsl, upsert::excluded};
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

    pub fn save_best(
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
            .on_conflict((scores::slug, scores::name))
            .do_update()
            .set((
                scores::score.eq(diesel::dsl::sql::<diesel::sql_types::Int4>(
                    "GREATEST(scores.score, EXCLUDED.score)",
                )),
                scores::created_at.eq(excluded(scores::created_at)),
            ))
            .get_result(connection)
            .map_err(|error| AppError::Internal(format!("database operation failed: {error}")))
    }

    pub fn list_by_slug(
        &self,
        connection: &mut diesel::PgConnection,
        slug_value: &str,
    ) -> Result<Vec<Score>, AppError> {
        scores::table
            .filter(scores::slug.eq(slug_value))
            .order((scores::score.desc(), scores::created_at.desc()))
            .load::<Score>(connection)
            .map_err(|error| AppError::Internal(format!("database operation failed: {error}")))
    }
}
