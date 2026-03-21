use std::{env, num::ParseIntError};

use crate::errors::AppError;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub cors_allowed_origins: Vec<String>,
    pub auth: AuthConfig,
}

#[derive(Debug, Clone)]
pub struct AuthConfig {
    pub admin_username: String,
    pub admin_password_hash: String,
    pub jwt_private_key_pem: String,
    pub jwt_public_key_pem: String,
    pub jwt_key_id: String,
    pub jwt_issuer: String,
    pub jwt_access_token_ttl_minutes: u64,
}

impl Config {
    pub fn from_env() -> Result<Self, AppError> {
        dotenvy::dotenv().ok();
        dotenvy::from_filename_override(".env.local").ok();

        let host = env::var("APP_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = env::var("APP_PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .map_err(ConfigError::InvalidPort)?;
        let database_url = env::var("DATABASE_URL").map_err(|_| ConfigError::MissingDatabaseUrl)?;
        let cors_allowed_origins = env::var("CORS_ALLOWED_ORIGINS")
            .map(|value| {
                value
                    .split(',')
                    .map(str::trim)
                    .filter(|origin| !origin.is_empty())
                    .map(ToString::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let auth = AuthConfig::from_env()?;

        Ok(Self {
            host,
            port,
            database_url,
            cors_allowed_origins,
            auth,
        })
    }
}

impl AuthConfig {
    fn from_env() -> Result<Self, AppError> {
        let admin_username =
            env::var("ADMIN_USERNAME").map_err(|_| ConfigError::Missing("ADMIN_USERNAME"))?;
        let admin_password_hash = env::var("ADMIN_PASSWORD_HASH")
            .map_err(|_| ConfigError::Missing("ADMIN_PASSWORD_HASH"))?;
        let jwt_private_key_pem = decode_pem_env(
            env::var("JWT_PRIVATE_KEY_PEM")
                .map_err(|_| ConfigError::Missing("JWT_PRIVATE_KEY_PEM"))?,
        );
        let jwt_public_key_pem = decode_pem_env(
            env::var("JWT_PUBLIC_KEY_PEM")
                .map_err(|_| ConfigError::Missing("JWT_PUBLIC_KEY_PEM"))?,
        );
        let jwt_key_id = env::var("JWT_KEY_ID").map_err(|_| ConfigError::Missing("JWT_KEY_ID"))?;
        let jwt_issuer = env::var("JWT_ISSUER").map_err(|_| ConfigError::Missing("JWT_ISSUER"))?;
        let jwt_access_token_ttl_minutes = env::var("JWT_ACCESS_TOKEN_TTL_MINUTES")
            .unwrap_or_else(|_| "60".to_string())
            .parse::<u64>()
            .map_err(ConfigError::InvalidJwtTtl)?;

        Ok(Self {
            admin_username,
            admin_password_hash,
            jwt_private_key_pem,
            jwt_public_key_pem,
            jwt_key_id,
            jwt_issuer,
            jwt_access_token_ttl_minutes,
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("APP_PORT must be a valid u16")]
    InvalidPort(#[source] ParseIntError),
    #[error("JWT_ACCESS_TOKEN_TTL_MINUTES must be a valid u64")]
    InvalidJwtTtl(#[source] ParseIntError),
    #[error("DATABASE_URL is required")]
    MissingDatabaseUrl,
    #[error("{0} is required")]
    Missing(&'static str),
}

impl From<ConfigError> for AppError {
    fn from(value: ConfigError) -> Self {
        AppError::Configuration(value.to_string())
    }
}

fn decode_pem_env(value: String) -> String {
    value.trim().trim_matches('"').replace("\\n", "\n")
}
