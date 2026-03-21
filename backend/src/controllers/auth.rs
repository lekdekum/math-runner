use axum::{
    Json,
    extract::State,
    http::{HeaderMap, header},
};
use tracing::info;

use crate::{
    app::AppState,
    errors::AppError,
    models::auth::{LoginRequest, LoginResponse},
};

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    let origin = headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("<missing>");
    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("<missing>");
    info!(
        "POST /login called for username '{}' from origin '{}' with user-agent '{}'",
        payload.username.trim(),
        origin,
        user_agent
    );
    let response = state.auth_service.login(payload)?;

    Ok(Json(response))
}
