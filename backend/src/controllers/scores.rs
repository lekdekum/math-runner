use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use tracing::info;

use crate::{
    app::AppState,
    errors::AppError,
    models::score::{CreateScoreRequest, RankingResponse, ScoreResponse},
};

pub async fn submit_score(
    State(state): State<AppState>,
    Path(question_slug): Path<String>,
    Json(payload): Json<CreateScoreRequest>,
) -> Result<(StatusCode, Json<ScoreResponse>), AppError> {
    info!("POST /submit-score/{question_slug} called");
    let score = state
        .score_service
        .submit_score(question_slug, payload)
        .await?;

    Ok((StatusCode::CREATED, Json(score)))
}

pub async fn get_rankings(
    State(state): State<AppState>,
    Path(question_slug): Path<String>,
) -> Result<Json<RankingResponse>, AppError> {
    info!("GET /rankings/{question_slug} called");
    let rankings = state.score_service.get_rankings(question_slug).await?;

    Ok(Json(rankings))
}
