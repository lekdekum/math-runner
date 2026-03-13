use backend::{app, config::Config, db};
use tokio::net::TcpListener;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    backend::telemetry::init();

    let config = Config::from_env()?;
    let pool = db::build_pool(&config.database_url)?;
    db::run_migrations(&pool)?;

    let app = app::build_router(pool, &config)?;
    let address = format!("{}:{}", config.host, config.port);
    let listener = TcpListener::bind(&address).await?;

    info!("listening on {}", address);
    axum::serve(listener, app).await?;

    Ok(())
}
