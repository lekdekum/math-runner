use crate::{
    auth::{AuthService, admin_auth_middleware},
    config::Config,
    controllers::auth as auth_controller,
    controllers::{questions, scores},
    db::DbPool,
    services::{questions::QuestionService, scores::ScoreService},
};
use axum::{
    http::{
        HeaderValue, Method,
        header::{AUTHORIZATION, CONTENT_TYPE},
    },
    Router, middleware,
    routing::{get, post},
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

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

    let explicit_origins = config
        .cors_allowed_origins
        .iter()
        .filter_map(|origin| HeaderValue::from_str(origin).ok())
        .collect::<Vec<_>>();
    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::AllowOrigin::predicate(move |origin, _request_parts| {
            if explicit_origins.iter().any(|allowed| allowed == origin) {
                return true;
            }

            match origin.to_str() {
                Ok("http://localhost:5173") | Ok("http://127.0.0.1:5173") => true,
                Ok(origin_value) => {
                    origin_value.starts_with("https://")
                        && origin_value.ends_with(".vercel.app")
                }
                Err(_) => false,
            }
        }))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([AUTHORIZATION, CONTENT_TYPE]);

    Ok(Router::new()
        .route("/login", post(auth_controller::login))
        .route("/submit-score/{question_slug}", post(scores::submit_score))
        .route("/rankings/{question_slug}", get(scores::get_rankings))
        .route("/questions/{question_slug}", get(questions::get_question))
        .route("/health", get(questions::health_check))
        .merge(protected_routes)
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http()))
}
