use diesel::{
    PgConnection,
    r2d2::{ConnectionManager, Pool},
};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};

use crate::errors::AppError;

pub type DbPool = Pool<ConnectionManager<PgConnection>>;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

pub fn build_pool(database_url: &str) -> Result<DbPool, AppError> {
    let manager = ConnectionManager::<PgConnection>::new(database_url);

    Pool::builder().build(manager).map_err(|error| {
        AppError::Configuration(format!("failed to create database pool: {error}"))
    })
}

pub fn run_migrations(pool: &DbPool) -> Result<(), AppError> {
    let mut connection = pool.get().map_err(|error| {
        AppError::Configuration(format!("failed to get database connection: {error}"))
    })?;

    connection
        .run_pending_migrations(MIGRATIONS)
        .map_err(|error| AppError::Configuration(format!("failed to run migrations: {error}")))?;

    Ok(())
}
