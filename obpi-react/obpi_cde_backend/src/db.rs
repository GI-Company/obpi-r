use crate::protocol::UserInfo;
use rand::{Rng, thread_rng};
use sha2::{Digest, Sha256};
use sqlx::{sqlite::{Sqlite, SqlitePoolOptions}, migrate::MigrateDatabase, Row, SqlitePool};
use std::env;

pub type DbPool = SqlitePool;

pub async fn init_db() -> Result<DbPool, sqlx::Error> {
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    
    if !Sqlite::database_exists(&db_url).await.unwrap_or(false) {
        Sqlite::create_database(&db_url).await?;
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("Database migrations complete.");

    setup_initial_users(&pool).await?;

    Ok(pool)
}

fn hash_password(password: &str, salt: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(salt);
    hasher.finalize().to_vec()
}

pub async fn verify_password(pool: &DbPool, username: &str, password: &str) -> Result<Option<UserInfo>, anyhow::Error> {
    let row = sqlx::query("SELECT id, username, role, password_hash FROM users WHERE username = ?")
        .bind(username)
        .fetch_optional(pool)
        .await?;

    if let Some(row) = row {
        let stored_hash_str: String = row.try_get("password_hash")?;
        let parts: Vec<&str> = stored_hash_str.split(':').collect();
        if parts.len() != 2 {
            return Err(anyhow::anyhow!("Invalid password hash format in DB"));
        }

        let salt = hex::decode(parts[0])?;
        let stored_hash = hex::decode(parts[1])?;
        let provided_hash = hash_password(password, &salt);

        if provided_hash == stored_hash {
            Ok(Some(UserInfo {
                id: row.try_get("id")?,
                username: row.try_get("username")?,
                role: row.try_get("role")?,
            }))
        } else {
            Ok(None)
        }
    } else {
        Ok(None)
    }
}

async fn create_user_if_not_exists(pool: &DbPool, username: &str, password: &str, role: &str) -> Result<(), sqlx::Error> {
    let user_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE username = ?")
        .bind(username)
        .fetch_one(pool)
        .await?;

    if user_exists.0 == 0 {
        tracing::info!("Creating user '{}'...", username);
        let mut rng = thread_rng();
        let salt: [u8; 16] = rng.gen();
        let password_hash = hash_password(password, &salt);
        let password_hash_str = format!("{}:{}", hex::encode(salt), hex::encode(password_hash));

        let user_id = sqlx::query("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
            .bind(username)
            .bind(&password_hash_str)
            .bind(role)
            .execute(pool)
            .await?
            .last_insert_rowid();
        
        sqlx::query("INSERT INTO files (owner_id, parent_id, name, node_type, original_path) VALUES (?, NULL, ?, 'dir', ?)")
            .bind(user_id)
            .bind(format!("/home/{}", username))
            .bind(format!("/home/{}", username))
            .execute(pool)
            .await?;
        
        tracing::info!("User '{}' created successfully.", username);
    }
    Ok(())
}

async fn setup_initial_users(pool: &DbPool) -> Result<(), sqlx::Error> {
    create_user_if_not_exists(pool, "guest", "password", "Admin").await?;
    create_user_if_not_exists(pool, "root", "root", "Admin").await?;
    Ok(())
}
