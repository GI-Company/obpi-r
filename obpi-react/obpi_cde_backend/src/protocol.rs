use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

pub type RequestId = String;

#[derive(Deserialize, Debug)]
pub struct ClientRequest {
    pub request_id: RequestId,
    #[serde(flatten)]
    pub payload: ClientRequestPayload,
}

#[derive(Deserialize, Debug)]
#[serde(tag = "type", content = "payload")]
#[serde(rename_all = "camelCase")]
pub enum ClientRequestPayload {
    Login { username: String, password: String },
    RunCommand { command: String },
    VfsList { path: String },
    VfsReadFile { path: String },
    VfsWriteFile { path: String, content: String },
    VfsCreateNode { path: String, node_type: String },
    VfsMoveNode { old_path: String, new_path: String },
    VfsTrashNode { path: String },
    VfsListTrash,
    VfsRestoreNode { id: i64 },
    VfsDeleteNode { id: i64 },
    VfsEmptyTrash,
}

#[derive(Serialize, Debug)]
pub struct ServerResponse {
    pub request_id: RequestId,
    #[serde(flatten)]
    pub payload: ServerResponsePayload,
}

#[derive(Serialize, Debug)]
#[serde(tag = "type", content = "payload")]
#[serde(rename_all = "camelCase")]
pub enum ServerResponsePayload {
    LoginSuccess { user: UserInfo },
    Error { message: String },
    VfsListResponse { items: Vec<FileNode> },
    VfsReadFileResponse { content: String },
    Success,
    VfsListTrashResponse { items: Vec<TrashedFileNode> },
}

#[derive(Serialize, Debug)]
#[serde(untagged)]
pub enum ServerMessage {
    Response(ServerResponse),
    Push(ServerPush),
}

#[derive(Serialize, Debug)]
pub struct ServerPush {
    #[serde(flatten)]
    pub payload: ServerPushPayload,
}

#[derive(Serialize, Debug)]
#[serde(tag = "type", content = "payload")]
#[serde(rename_all = "camelCase")]
pub enum ServerPushPayload {
    TerminalOutput { output: String },
    VfsUpdate { path: String },
}

#[derive(Serialize, Debug, Clone)]
pub struct UserInfo {
    pub id: i64,
    pub username: String,
    pub role: String,
}

#[derive(Serialize, Debug, sqlx::FromRow)]
pub struct FileNode {
    pub name: String,
    pub node_type: String,
    pub size: i64,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Debug, sqlx::FromRow)]
pub struct TrashedFileNode {
    pub id: i64,
    pub name: String,
    pub original_path: String,
    pub trashed_at: DateTime<Utc>,
}
