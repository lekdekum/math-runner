use crate::{
    auth::{AuthService, admin_auth_middleware},
    config::Config,
    controllers::auth as auth_controller,
    controllers::{questions, scores},
    db::DbPool,
    services::{questions::QuestionService, scores::ScoreService},
};
use axum::{
    Router, middleware,
    routing::{get, post},
};
use tower_http::trace::TraceLayer;

#[derive(Clone)]
pub struct AppState {
    pub auth_service: AuthService,
    pub question_service: QuestionService,
    pub score_service: ScoreService,
}

pub fn build_router(pool: DbPool, config: &Config) -> Result<Router, crate::errors::AppError> {
    let auth_service = AuthService::from_config(&config.auth)?;
    let question_service = QuestionService::new(pool);
    let score_service = ScoreService::new(question_service.clone());
    let state = AppState {
        auth_service,
        question_service,
        score_service,
    };

    let protected_routes = Router::new()
        .route("/list-questions", get(questions::list_questions))
        .route(
            "/questions_csv/{question_slug}",
            post(questions::import_questions_csv),
        )
        .route(
            "/questions/{question_slug}",
            post(questions::create_question),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            admin_auth_middleware,
        ));

    Ok(Router::new()
        .route("/login", post(auth_controller::login))
        .route("/submit-score/{question_slug}", post(scores::submit_score))
        .route("/rankings/{question_slug}", get(scores::get_rankings))
        .route("/questions/{question_slug}", get(questions::get_question))
        .route("/health", get(questions::health_check))
        .merge(protected_routes)
        .with_state(state)
        .layer(TraceLayer::new_for_http()))
}
