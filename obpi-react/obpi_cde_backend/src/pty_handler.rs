use pty_process_tokio::PtyProcess;
use std::path::PathBuf;
use std::process::Command;
use tokio::io::{AsyncWriteExt, AsyncReadExt};
use tokio::sync::mpsc;

pub enum PtyMessage {
    Output(String),
}

pub struct PtyHandler {
    pty_writer: Option<mpsc::UnboundedSender<String>>,
}

impl PtyHandler {
    pub fn new() -> Self { Self { pty_writer: None } }

    pub fn spawn(&mut self, _cwd: PathBuf, output_tx: mpsc::UnboundedSender<PtyMessage>) -> Result<(), String> {
        let process = PtyProcess::spawn(Command::new("bash")).map_err(|e| e.to_string())?;
        let (pty_tx, mut pty_rx) = mpsc::unbounded_channel::<String>();
        self.pty_writer = Some(pty_tx);

        let mut master = process.master.clone();
        let mut child_writer = process.child_writer.clone();

        tokio::spawn(async move {
            while let Some(cmd) = pty_rx.recv().await {
                if child_writer.write_all(cmd.as_bytes()).await.is_err() { break; }
            }
        });

        tokio::spawn(async move {
            let mut buf = [0u8; 4096];
            loop {
                match master.read(&mut buf).await {
                    Ok(0) | Err(_) => { break; }
                    Ok(n) => {
                        if let Ok(s) = String::from_utf8(buf[..n].to_vec()) {
                            if output_tx.send(PtyMessage::Output(s)).is_err() { break; }
                        }
                    }
                }
            }
        });

        Ok(())
    }

    pub fn send_command(&self, cmd: String) {
        if let Some(writer) = &self.pty_writer {
            if writer.send(cmd).is_err() {
                tracing::error!("Failed to send command to PTY writer task.");
            }
        }
    }
}
