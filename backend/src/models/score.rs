use chrono::NaiveDateTime;
use diesel::{Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::scores;

#[derive(Debug, Clone, Queryable, Selectable)]
#[diesel(table_name = scores)]
pub struct Score {
    pub id: Uuid,
    pub name: String,
    pub score: i32,
    pub slug: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = scores)]
pub struct NewScore {
    pub id: Uuid,
    pub name: String,
    pub score: i32,
    pub slug: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateScoreRequest {
    pub name: String,
    pub score: i32,
}

#[derive(Debug, Serialize)]
pub struct ScoreResponse {
    pub id: Uuid,
    pub name: String,
    pub score: i32,
    pub slug: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize)]
pub struct RankingResponse {
    pub slug: String,
    pub scores: Vec<ScoreResponse>,
}

impl From<Score> for ScoreResponse {
    fn from(value: Score) -> Self {
        Self {
            id: value.id,
            name: value.name,
            score: value.score,
            slug: value.slug,
            created_at: value.created_at,
        }
    }
}
