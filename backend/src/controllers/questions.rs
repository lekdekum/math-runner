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
    models::question::{QuestionListResponse, QuestionResponse},
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
    let question = state
        .question_service
        .create_question(question_slug, payload)
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
    let field = multipart
        .next_field()
        .await
        .map_err(|error| {
            AppError::BadRequest(format!("failed to read multipart payload: {error}"))
        })?
        .ok_or_else(|| {
            AppError::BadRequest("multipart payload must include a CSV file".to_string())
        })?;

    let file_name = field.file_name().unwrap_or("upload.csv").to_string();
    info!("POST /questions_csv/{question_slug} called with file {file_name}");

    let bytes = field
        .bytes()
        .await
        .map_err(|error| AppError::BadRequest(format!("failed to read uploaded file: {error}")))?;

    let question = state
        .question_service
        .import_questions_csv(question_slug, bytes.to_vec())
        .await?;

    Ok((StatusCode::CREATED, Json(question)))
}
