use crate::{
    controllers::{questions, scores},
    db::DbPool,
    services::{questions::QuestionService, scores::ScoreService},
};
use axum::{
    Router,
    routing::{get, post},
};
use tower_http::trace::TraceLayer;

#[derive(Clone)]
pub struct AppState {
    pub question_service: QuestionService,
    pub score_service: ScoreService,
}

pub fn build_router(pool: DbPool) -> Router {
    let question_service = QuestionService::new(pool);
    let score_service = ScoreService::new(question_service.clone());
    let state = AppState {
        question_service,
        score_service,
    };

    Router::new()
        .route("/list-questions", get(questions::list_questions))
        .route("/submit-score/{question_slug}", post(scores::submit_score))
        .route(
            "/questions_csv/{question_slug}",
            post(questions::import_questions_csv),
        )
        .route(
            "/questions/{question_slug}",
            post(questions::create_question).get(questions::get_question),
        )
        .route("/health", get(questions::health_check))
        .with_state(state)
        .layer(TraceLayer::new_for_http())
}
