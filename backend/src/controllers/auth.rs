use axum::{Json, extract::State};
use tracing::info;

use crate::{
    app::AppState,
    errors::AppError,
    models::auth::{LoginRequest, LoginResponse},
};

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    info!(
        "POST /login called for username '{}'",
        payload.username.trim()
    );
    let response = state.auth_service.login(payload)?;

    Ok(Json(response))
}
