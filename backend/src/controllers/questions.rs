use axum::{
    Json,
    extract::{Multipart, Path, State},
    http::StatusCode,
};
use serde_json::Value;
use tracing::info;

use crate::{
    app::AppState,
    errors::AppError,
    models::question::{CreateQuestionPayload, QuestionListResponse, QuestionResponse},
};

pub async fn health_check() -> StatusCode {
    info!("GET /health called");
    StatusCode::OK
}

pub async fn create_question(
    State(state): State<AppState>,
    Path(question_slug): Path<String>,
    Json(payload): Json<Value>,
) -> Result<(StatusCode, Json<QuestionResponse>), AppError> {
    info!("POST /questions/{question_slug} called");
    let (name, payload) = split_create_payload(payload);
    let question = state
        .question_service
        .create_question(question_slug, name, payload)
        .await?;

    Ok((StatusCode::CREATED, Json(question)))
}

pub async fn get_question(
    State(state): State<AppState>,
    Path(question_slug): Path<String>,
) -> Result<Json<QuestionResponse>, AppError> {
    info!("GET /questions/{question_slug} called");
    let question = state.question_service.get_question(question_slug).await?;

    Ok(Json(question))
}

pub async fn list_questions(
    State(state): State<AppState>,
) -> Result<Json<QuestionListResponse>, AppError> {
    info!("GET /list-questions called");
    let response = state.question_service.list_questions().await?;

    Ok(Json(response))
}

pub async fn import_questions_csv(
    State(state): State<AppState>,
    Path(question_slug): Path<String>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<QuestionResponse>), AppError> {
    let mut uploaded_name = None;
    let mut file_name = None;
    let mut bytes = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|error| {
            AppError::BadRequest(format!("failed to read multipart payload: {error}"))
        })?
    {
        match field.name() {
            Some("name") => {
                let value = field.text().await.map_err(|error| {
                    AppError::BadRequest(format!("failed to read multipart field: {error}"))
                })?;
                uploaded_name = Some(value);
            }
            _ => {
                file_name = Some(field.file_name().unwrap_or("upload.csv").to_string());
                bytes = Some(field.bytes().await.map_err(|error| {
                    AppError::BadRequest(format!("failed to read uploaded file: {error}"))
                })?);
            }
        }
    }

    let file_name = file_name.ok_or_else(|| {
        AppError::BadRequest("multipart payload must include a CSV file".to_string())
    })?;
    let bytes = bytes.ok_or_else(|| {
        AppError::BadRequest("multipart payload must include a CSV file".to_string())
    })?;

    info!("POST /questions_csv/{question_slug} called with file {file_name}");

    let question = state
        .question_service
        .import_questions_csv(question_slug, uploaded_name, bytes.to_vec())
        .await?;

    Ok((StatusCode::CREATED, Json(question)))
}

fn split_create_payload(payload: Value) -> (Option<String>, Value) {
    serde_json::from_value::<CreateQuestionPayload>(payload.clone())
        .map(|request| (request.name, request.payload))
        .unwrap_or((None, payload))
}
