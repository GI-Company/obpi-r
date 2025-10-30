use axum::extract::ws::{Message, WebSocket};
use futures_util::{stream::{SplitSink}, StreamExt};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;
use crate::db::{self, DbPool};
use crate::pty_handler::{PtyHandler, PtyMessage};
use crate::protocol::{ClientRequest, ClientRequestPayload, ServerMessage, ServerPush, ServerPushPayload, ServerResponse, ServerResponsePayload, UserInfo};
use crate::vfs;

pub struct UserSession {
    ws: WebSocket,
    db_pool: Arc<DbPool>,
    pty_handler: PtyHandler,
    user: Option<UserInfo>,
    cwd: PathBuf,
}

impl UserSession {
    pub fn new(socket: WebSocket, db_pool: Arc<DbPool>) -> Self {
        Self {
            ws: socket,
            db_pool,
            pty_handler: PtyHandler::new(),
            user: None,
            cwd: PathBuf::from("/"),
        }
    }

    pub async fn run(mut self) {
        let (mut ws_sender, mut ws_receiver) = self.ws.split();
        let (pty_tx, mut pty_rx) = mpsc::unbounded_channel();
        
        loop {
            tokio::select! {
                ws_msg = ws_receiver.next() => {
                    if let Some(Ok(msg)) = ws_msg {
                        if self.handle_client_message(msg, &pty_tx, &mut ws_sender).await.is_err() { break; }
                    } else { break; }
                },
                pty_msg = pty_rx.recv() => {
                    if let Some(PtyMessage::Output(output)) = pty_msg {
                        let _ = self.send_push(ServerPushPayload::TerminalOutput { output }, &mut ws_sender).await;
                    } else { break; }
                }
            }
        }
        tracing::debug!("User session for '{:?}' ended.", self.user.as_ref().map(|u| &u.username));
    }

    async fn handle_client_message(&mut self, msg: Message, pty_tx: &mpsc::UnboundedSender<PtyMessage>, ws_sender: &mut SplitSink<WebSocket, Message>) -> Result<(), ()> {
        if let Message::Text(text) = msg {
            match serde_json::from_str::<ClientRequest>(&text) {
                Ok(req) => {
                    let req_id = req.request_id.clone();
                    if self.user.is_none() {
                        if let ClientRequestPayload::Login { username, password } = req.payload {
                            self.handle_login(req_id, username, password, pty_tx, ws_sender).await;
                        } else {
                            self.send_error_response(req_id, "Authentication required".to_string(), ws_sender).await;
                        }
                    } else {
                        self.handle_authenticated_request(req, ws_sender).await;
                    }
                }
                Err(e) => self.send_error_response("unknown".to_string(), format!("Invalid request format: {}", e), ws_sender).await,
            }
        } else if let Message::Close(_) = msg {
            return Err(());
        }
        Ok(())
    }
    
    async fn handle_login(&mut self, req_id: String, username: String, password: String, pty_tx: &mpsc::UnboundedSender<PtyMessage>, ws_sender: &mut SplitSink<WebSocket, Message>) {
        match db::verify_password(&self.db_pool, &username, &password).await {
            Ok(Some(user)) => {
                let home_dir = PathBuf::from(format!("/home/{}", &user.username));
                if self.pty_handler.spawn(home_dir.clone(), pty_tx.clone()).is_ok() {
                    self.cwd = home_dir;
                    self.user = Some(user.clone());
                    self.send_response(req_id, ServerResponsePayload::LoginSuccess { user }, ws_sender).await;
                } else {
                    self.send_error_response(req_id, "Failed to start terminal session".to_string(), ws_sender).await;
                }
            }
            Ok(None) => self.send_error_response(req_id, "Invalid credentials".to_string(), ws_sender).await,
            Err(e) => self.send_error_response(req_id, format!("Login error: {}", e), ws_sender).await,
        }
    }

    async fn handle_authenticated_request(&mut self, req: ClientRequest, ws_sender: &mut SplitSink<WebSocket, Message>) {
        let user_id = self.user.as_ref().unwrap().id;
        let req_id = req.request_id;
        let user_home_dir = format!("/home/{}", self.user.as_ref().unwrap().username);

        let resolve = |p: &str| vfs::resolve_path(&self.cwd, p, &user_home_dir).to_string_lossy().to_string();

        match req.payload {
            ClientRequestPayload::RunCommand { command } => {
                if command.trim().starts_with("cd ") {
                    let target = command.trim().split_whitespace().nth(1).unwrap_or("~");
                    self.cwd = vfs::resolve_path(&self.cwd, target, &user_home_dir);
                }
                self.pty_handler.send_command(command + "\n");
            }
            ClientRequestPayload::VfsList { path } => {
                match vfs::list_directory(&self.db_pool, user_id, &resolve(&path)).await {
                    Ok(items) => self.send_response(req_id, ServerResponsePayload::VfsListResponse { items }, ws_sender).await,
                    Err(e) => self.send_error_response(req_id, e.to_string(), ws_sender).await,
                }
            }
            ClientRequestPayload::VfsReadFile { path } => {
                match vfs::read_file_content(&self.db_pool, user_id, &resolve(&path)).await {
                    Ok(content) => self.send_response(req_id, ServerResponsePayload::VfsReadFileResponse { content }, ws_sender).await,
                    Err(e) => self.send_error_response(req_id, e.to_string(), ws_sender).await,
                }
            }
            ClientRequestPayload::VfsWriteFile { path, content } => {
                let resolved_path = resolve(&path);
                match vfs::write_file_content(&self.db_pool, user_id, &resolved_path, &content).await {
                    Ok(_) => { self.send_response_and_push_vfs(req_id, resolved_path, ws_sender).await; },
                    Err(e) => self.send_error_response(req_id, e.to_string(), ws_sender).await,
                }
            }
            ClientRequestPayload::VfsCreateNode { path, node_type } => {
                let resolved_path = resolve(&path);
                match vfs::create_node(&self.db_pool, user_id, &resolved_path, &node_type).await {
                    Ok(_) => { self.send_response_and_push_vfs(req_id, resolved_path, ws_sender).await; },
                    Err(e) => self.send_error_response(req_id, e.to_string(), ws_sender).await,
                }
            }
            ClientRequestPayload::VfsMoveNode { old_path, new_path } => {
                let resolved_old = resolve(&old_path);
                let resolved_new = resolve(&new_path);
                match vfs::move_node(&self.db_pool, user_id, &resolved_old, &resolved_new).await {
                    Ok(_) => {
                        self.send_response(req_id, ServerResponsePayload::Success, ws_sender).await;
                        let _ = self.send_push(ServerPushPayload::VfsUpdate{ path: resolved_old }, ws_sender).await;
                        let _ = self.send_push(ServerPushPayload::VfsUpdate{ path: resolved_new }, ws_sender).await;
                    },
                    Err(e) => self.send_error_response(req_id, e.to_string(), ws_sender).await,
                }
            }
            ClientRequestPayload::VfsTrashNode { path } => {
                let resolved_path = resolve(&path);
                match vfs::trash_node(&self.db_pool, user_id, &resolved_path).await {
                    Ok(_) => { self.send_response_and_push_vfs(req_id, resolved_path, ws_sender).await; },
                    Err(e) => self.send_error_response(req_id, e.to_string(), ws_sender).await,
                }
            }
            ClientRequestPayload::VfsListTrash => {
                match vfs::list_trash(&self.db_pool, user_id).await {
                    Ok(items) => self.send_response(req_id, ServerResponsePayload::VfsListTrashResponse { items }, ws_sender).await,
                    Err(e) => self.send_error_response(req_id, e.to_string(), ws_sender).await,
                }
            }
            ClientRequestPayload::VfsRestoreNode { id } => {
                match vfs::restore_node(&self.db_pool, user_id, id).await {
                    Ok(path) => { self.send_response_and_push_vfs(req_id, path, ws_sender).await; },
                    Err(e) => self.send_error_response(req_id, e.to_string(), ws_sender).await,
                }
            }
            ClientRequestPayload::VfsDeleteNode { id } => {
                match vfs::permanently_delete_node(&self.db_pool, user_id, id).await {
                    Ok(_) => self.send_response(req_id, ServerResponsePayload::Success, ws_sender).await,
                    Err(e) => self.send_error_response(req_id, e.to_string(), ws_sender).await,
                }
            }
            ClientRequestPayload::VfsEmptyTrash => {
                match vfs::empty_trash(&self.db_pool, user_id).await {
                    Ok(_) => self.send_response(req_id, ServerResponsePayload::Success, ws_sender).await,
                    Err(e) => self.send_error_response(req_id, e.to_string(), ws_sender).await,
                }
            }
            _ => self.send_error_response(req_id, "Unsupported action".to_string(), ws_sender).await,
        }
    }
    
    async fn send_response_and_push_vfs(&self, req_id: String, path: String, ws_sender: &mut SplitSink<WebSocket, Message>) {
        self.send_response(req_id, ServerResponsePayload::Success, ws_sender).await;
        let _ = self.send_push(ServerPushPayload::VfsUpdate{ path }, ws_sender).await;
    }
    
    async fn send_response(&self, request_id: String, payload: ServerResponsePayload, sender: &mut SplitSink<WebSocket, Message>) {
        let response = ServerMessage::Response(ServerResponse { request_id, payload });
        if let Ok(json) = serde_json::to_string(&response) {
            if sender.send(Message::Text(json)).await.is_err() {
                tracing::warn!("Failed to send response to client.");
            }
        }
    }

    async fn send_error_response(&self, request_id: String, message: String, sender: &mut SplitSink<WebSocket, Message>) {
        tracing::error!("Sending error to client: {}", message);
        self.send_response(request_id, ServerResponsePayload::Error { message }, sender).await;
    }
    
    async fn send_push(&self, payload: ServerPushPayload, sender: &mut SplitSink<WebSocket, Message>) {
        let push = ServerMessage::Push(ServerPush { payload });
        if let Ok(json) = serde_json::to_string(&push) {
            if sender.send(Message::Text(json)).await.is_err() {
                tracing::warn!("Failed to send push notification to client.");
            }
        }
    }
}
