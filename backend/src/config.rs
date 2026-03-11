use std::{env, num::ParseIntError};

use crate::errors::AppError;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
}

impl Config {
    pub fn from_env() -> Result<Self, AppError> {
        dotenvy::dotenv().ok();

        let host = env::var("APP_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = env::var("APP_PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .map_err(ConfigError::InvalidPort)?;
        let database_url = env::var("DATABASE_URL").map_err(|_| ConfigError::MissingDatabaseUrl)?;

        Ok(Self {
            host,
            port,
            database_url,
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("APP_PORT must be a valid u16")]
    InvalidPort(#[source] ParseIntError),
    #[error("DATABASE_URL is required")]
    MissingDatabaseUrl,
}

impl From<ConfigError> for AppError {
    fn from(value: ConfigError) -> Self {
        AppError::Configuration(value.to_string())
    }
}
