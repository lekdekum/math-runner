use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::{extract::Request, http::header, middleware::Next, response::Response};
use base64ct::{Base64UrlUnpadded, Encoding};
use jsonwebtoken::{
    Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, decode_header, encode,
};
use rsa::{RsaPublicKey, pkcs8::DecodePublicKey, traits::PublicKeyParts};
use tracing::{info, warn};

use crate::{
    app::AppState,
    config::AuthConfig,
    errors::AppError,
    models::auth::{AuthClaims, Jwk, JwkSet, LoginRequest, LoginResponse},
};

#[derive(Clone)]
pub struct AuthService {
    inner: Arc<AuthContext>,
}

struct AuthContext {
    admin_username: String,
    admin_password_hash: String,
    encoding_key: EncodingKey,
    decoding_keys: HashMap<String, DecodingKey>,
    issuer: String,
    key_id: String,
    ttl: Duration,
    jwks: JwkSet,
}

impl AuthService {
    pub fn from_config(config: &AuthConfig) -> Result<Self, AppError> {
        let encoding_key = EncodingKey::from_rsa_pem(config.jwt_private_key_pem.as_bytes())
            .map_err(|error| {
                AppError::Configuration(format!("invalid JWT private key: {error}"))
            })?;
        let decoding_key = DecodingKey::from_rsa_pem(config.jwt_public_key_pem.as_bytes())
            .map_err(|error| AppError::Configuration(format!("invalid JWT public key: {error}")))?;
        let jwk = build_jwk(&config.jwt_public_key_pem, &config.jwt_key_id)?;
        let mut decoding_keys = HashMap::new();
        decoding_keys.insert(config.jwt_key_id.clone(), decoding_key);

        Ok(Self {
            inner: Arc::new(AuthContext {
                admin_username: config.admin_username.clone(),
                admin_password_hash: config.admin_password_hash.clone(),
                encoding_key,
                decoding_keys,
                issuer: config.jwt_issuer.clone(),
                key_id: config.jwt_key_id.clone(),
                ttl: Duration::from_secs(config.jwt_access_token_ttl_minutes * 60),
                jwks: JwkSet { keys: vec![jwk] },
            }),
        })
    }

    pub fn login(&self, payload: LoginRequest) -> Result<LoginResponse, AppError> {
        let username = payload.username.trim();

        if username != self.inner.admin_username {
            warn!("login failed for username '{}'", username);
            return Err(AppError::Unauthorized("invalid credentials".to_string()));
        }

        let password_hash =
            PasswordHash::new(&self.inner.admin_password_hash).map_err(|error| {
                AppError::Configuration(format!("invalid ADMIN_PASSWORD_HASH value: {error}"))
            })?;

        Argon2::default()
            .verify_password(payload.password.as_bytes(), &password_hash)
            .map_err(|_| AppError::Unauthorized("invalid credentials".to_string()))?;

        let now = unix_timestamp(SystemTime::now())?;
        let exp = now
            .checked_add(self.inner.ttl.as_secs())
            .ok_or_else(|| AppError::Internal("failed to compute token expiry".to_string()))?;
        let claims = AuthClaims {
            sub: self.inner.admin_username.clone(),
            iss: self.inner.issuer.clone(),
            iat: now,
            exp,
        };
        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(self.inner.key_id.clone());

        let access_token = encode(&header, &claims, &self.inner.encoding_key)
            .map_err(|error| AppError::Internal(format!("failed to create JWT: {error}")))?;

        info!("login succeeded for username '{}'", username);

        Ok(LoginResponse {
            access_token,
            token_type: "Bearer".to_string(),
            expires_in: self.inner.ttl.as_secs(),
        })
    }

    pub fn verify_token(&self, token: &str) -> Result<AuthClaims, AppError> {
        let header = decode_header(token)
            .map_err(|_| AppError::Unauthorized("invalid bearer token".to_string()))?;

        if header.alg != Algorithm::RS256 {
            return Err(AppError::Unauthorized("invalid bearer token".to_string()));
        }

        let kid = header
            .kid
            .ok_or_else(|| AppError::Unauthorized("invalid bearer token".to_string()))?;

        if !self.inner.jwks.keys.iter().any(|key| key.kid == kid) {
            return Err(AppError::Unauthorized("invalid bearer token".to_string()));
        }

        let decoding_key = self
            .inner
            .decoding_keys
            .get(&kid)
            .ok_or_else(|| AppError::Unauthorized("invalid bearer token".to_string()))?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[self.inner.issuer.as_str()]);

        let data = decode::<AuthClaims>(token, decoding_key, &validation)
            .map_err(|_| AppError::Unauthorized("invalid bearer token".to_string()))?;

        Ok(data.claims)
    }
}

pub async fn admin_auth_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let header_value = request
        .headers()
        .get(header::AUTHORIZATION)
        .ok_or_else(|| AppError::Unauthorized("missing bearer token".to_string()))?;
    let header_value = header_value
        .to_str()
        .map_err(|_| AppError::Unauthorized("missing bearer token".to_string()))?;
    let token = header_value
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("missing bearer token".to_string()))?;

    let claims = state.auth_service.verify_token(token)?;
    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}

fn build_jwk(public_key_pem: &str, key_id: &str) -> Result<Jwk, AppError> {
    let public_key = RsaPublicKey::from_public_key_pem(public_key_pem)
        .map_err(|error| AppError::Configuration(format!("invalid JWT public key: {error}")))?;
    let modulus = Base64UrlUnpadded::encode_string(&public_key.n().to_bytes_be());
    let exponent = Base64UrlUnpadded::encode_string(&public_key.e().to_bytes_be());

    Ok(Jwk {
        kty: "RSA".to_string(),
        use_: "sig".to_string(),
        alg: "RS256".to_string(),
        kid: key_id.to_string(),
        n: modulus,
        e: exponent,
    })
}

fn unix_timestamp(now: SystemTime) -> Result<u64, AppError> {
    now.duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|error| AppError::Internal(format!("system clock error: {error}")))
}

#[cfg(test)]
mod tests {
    use argon2::{
        Argon2, PasswordHasher,
        password_hash::{SaltString, rand_core::OsRng},
    };
    use rand::thread_rng;
    use rsa::{
        RsaPrivateKey,
        pkcs8::{EncodePrivateKey, EncodePublicKey, LineEnding},
    };

    use super::AuthService;
    use crate::{config::AuthConfig, models::auth::LoginRequest};

    fn build_auth_service() -> AuthService {
        let mut rng = thread_rng();
        let private_key = RsaPrivateKey::new(&mut rng, 2048).unwrap();
        let public_key = private_key.to_public_key();
        let private_key_pem = private_key
            .to_pkcs8_pem(LineEnding::LF)
            .unwrap()
            .to_string();
        let public_key_pem = public_key
            .to_public_key_pem(LineEnding::LF)
            .unwrap()
            .to_string();
        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password("super-secret".as_bytes(), &salt)
            .unwrap()
            .to_string();

        AuthService::from_config(&AuthConfig {
            admin_username: "admin".to_string(),
            admin_password_hash: password_hash,
            jwt_private_key_pem: private_key_pem,
            jwt_public_key_pem: public_key_pem,
            jwt_key_id: "test-key".to_string(),
            jwt_issuer: "backend-test".to_string(),
            jwt_access_token_ttl_minutes: 60,
        })
        .unwrap()
    }

    #[test]
    fn login_returns_bearer_token_for_valid_credentials() {
        let auth_service = build_auth_service();

        let response = auth_service
            .login(LoginRequest {
                username: "admin".to_string(),
                password: "super-secret".to_string(),
            })
            .unwrap();

        assert_eq!(response.token_type, "Bearer");
        assert!(response.expires_in > 0);
        assert!(!response.access_token.is_empty());
    }

    #[test]
    fn login_rejects_invalid_password() {
        let auth_service = build_auth_service();

        let error = auth_service
            .login(LoginRequest {
                username: "admin".to_string(),
                password: "wrong-password".to_string(),
            })
            .unwrap_err();

        assert_eq!(error.to_string(), "invalid credentials");
    }

    #[test]
    fn verify_token_accepts_tokens_issued_by_service() {
        let auth_service = build_auth_service();
        let login = auth_service
            .login(LoginRequest {
                username: "admin".to_string(),
                password: "super-secret".to_string(),
            })
            .unwrap();

        let claims = auth_service.verify_token(&login.access_token).unwrap();

        assert_eq!(claims.sub, "admin");
        assert_eq!(claims.iss, "backend-test");
    }
}
