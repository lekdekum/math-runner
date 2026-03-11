use chrono::NaiveDateTime;
use diesel::{Insertable, Queryable, Selectable};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::schema::questions;

#[derive(Debug, Clone, Queryable, Selectable)]
#[diesel(table_name = questions)]
pub struct Question {
    pub id: Uuid,
    pub slug: String,
    pub payload: Value,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = questions)]
pub struct NewQuestion {
    pub id: Uuid,
    pub slug: String,
    pub payload: Value,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize)]
pub struct QuestionResponse {
    pub id: Uuid,
    pub slug: String,
    pub payload: Value,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct CsvQuestion {
    pub answers: Vec<Value>,
    pub question: String,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct CsvQuestionsResponse {
    pub questions: Vec<CsvQuestion>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct QuestionListResponse {
    pub slugs: Vec<String>,
}

impl From<Question> for QuestionResponse {
    fn from(value: Question) -> Self {
        Self {
            id: value.id,
            slug: value.slug,
            payload: value.payload,
            created_at: value.created_at,
        }
    }
}
