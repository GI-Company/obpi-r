# OBPI OS Cloud Kernel Backend (v0.3.0 - Seamless)

This is the Rust backend for the OBPI React Desktop project, acting as a true Cloud Development Environment (CDE) kernel. This version implements a fully persistent state, backend-driven authentication, and a robust request-response API.

## Architecture

This backend uses a hybrid storage approach for efficiency and scalability:

-   **Database (SQLite):** All metadata for users and the virtual file system (file names, directory structure, ownership, timestamps, trash status) is stored in a local `obpi_os.db` SQLite file. This is managed by `sqlx`.
-   **On-Disk Storage:** The actual content of user files is stored in a separate directory on the server's filesystem (default: `/tmp/cde_storage`). This keeps the database lean and makes handling large files efficient.
-   **Real-time API (WebSockets):** The frontend communicates with this backend via a WebSocket connection using a JSON-based request-response protocol for all operations.

## Features

-   **Persistent State:** User and file data persists between server restarts.
-   **Backend-driven Authentication:** Secure user login and session management.
-   **Database-Driven VFS:** All file system operations are transactional and managed through the database.
-   **Functional Recycle Bin:** Trashed files are tracked in the database and can be restored or permanently deleted.
-   **Secure Sandboxing:** Each user's files and terminal session are isolated.
-   **Pseudo-Terminal (PTY):** Provides a real `bash` shell for each user.
-   **Asynchronous Architecture:** Built on `tokio` for high performance.
-   **Automatic Migrations:** The database schema is automatically created and updated on startup using `sqlx-cli`.

## How to Run

The entire setup process is automated by the `start.sh` script in the project's root directory. See the main project README for instructions.
