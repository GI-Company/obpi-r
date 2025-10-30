use axum::{extract::{ws::{WebSocket, WebSocketUpgrade}, State}, response::Response, routing::get, Router};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod db;
mod pty_handler;
mod protocol;
mod session;
mod vfs;

use crate::db::DbPool;
use crate::session::UserSession;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "obpi_cde_backend=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenvy::dotenv().expect("Failed to read .env file");

    let db_pool = db::init_db().await.expect("Failed to initialize database");
    
    let app_state = Arc::new(db_pool);

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .with_state(app_state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    tracing::debug!("listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<DbPool>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, db_pool: Arc<DbPool>) {
    tracing::debug!("New WebSocket connection received.");
    UserSession::new(socket, db_pool).run().await;
}
