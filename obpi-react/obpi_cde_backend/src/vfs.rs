use crate::db::DbPool;
use crate::protocol::{FileNode, TrashedFileNode};
use anyhow::{anyhow, Result};
use chrono::Utc;
use sqlx::Row;
use std::env;
use std::path::{Path, PathBuf};
use tokio::fs;
use uuid::Uuid;

pub async fn list_directory(pool: &DbPool, user_id: i64, path_str: &str) -> Result<Vec<FileNode>> {
    let parent_id = get_path_id(pool, user_id, Path::new(path_str)).await?;
    let query = "SELECT name, node_type, size, updated_at FROM files WHERE owner_id = ? AND parent_id IS ? AND is_trashed = FALSE ORDER BY node_type DESC, name ASC";
    let items = sqlx::query_as(query)
        .bind(user_id)
        .bind(parent_id)
        .fetch_all(pool)
        .await?;
    Ok(items)
}

pub async fn read_file_content(pool: &DbPool, user_id: i64, path_str: &str) -> Result<String> {
    let (disk_path_str,): (String,) =
        sqlx::query_as("SELECT disk_path FROM files WHERE id = ? AND owner_id = ? AND node_type = 'file'")
            .bind(get_path_id(pool, user_id, Path::new(path_str)).await?.ok_or_else(|| anyhow!("File not found"))?)
            .bind(user_id)
            .fetch_one(pool)
            .await?;
    
    let content = fs::read(disk_path_str).await?;
    Ok(base64::encode(content))
}

pub async fn write_file_content(pool: &DbPool, user_id: i64, path_str: &str, base64_content: &str) -> Result<()> {
    let file_id = get_path_id(pool, user_id, Path::new(path_str)).await?.ok_or_else(|| anyhow!("File not found"))?;
    let content = base64::decode(base64_content)?;

    let (disk_path_str,): (Option<String>,) = sqlx::query_as("SELECT disk_path FROM files WHERE id = ?")
        .bind(file_id)
        .fetch_one(pool)
        .await?;
    
    if let Some(disk_path) = disk_path_str {
        fs::write(disk_path, &content).await?;
        sqlx::query("UPDATE files SET size = ?, updated_at = ? WHERE id = ?")
            .bind(content.len() as i64)
            .bind(Utc::now())
            .bind(file_id)
            .execute(pool)
            .await?;
        Ok(())
    } else {
        Err(anyhow!("Node is a directory, not a file"))
    }
}

pub async fn create_node(pool: &DbPool, user_id: i64, path_str: &str, node_type: &str) -> Result<()> {
    let path = Path::new(path_str);
    let name = path.file_name().and_then(|s| s.to_str()).ok_or_else(|| anyhow!("Invalid path or name"))?;
    let parent_path = path.parent().unwrap_or(Path::new("/"));
    let parent_id = get_path_id(pool, user_id, parent_path).await?;

    let mut tx = pool.begin().await?;

    let disk_path = if node_type == "file" {
        let storage_root = env::var("STORAGE_ROOT").unwrap_or_else(|_| "/tmp/cde_storage".to_string());
        fs::create_dir_all(&storage_root).await?;
        let disk_filename = Uuid::new_v4().to_string();
        let path = Path::new(&storage_root).join(disk_filename);
        fs::write(&path, "").await?;
        Some(path.to_str().unwrap().to_string())
    } else {
        None
    };

    sqlx::query("INSERT INTO files (owner_id, parent_id, name, node_type, disk_path, original_path) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(user_id)
        .bind(parent_id)
        .bind(name)
        .bind(node_type)
        .bind(disk_path)
        .bind(path_str)
        .execute(&mut *tx)
        .await?;
    
    tx.commit().await?;
    Ok(())
}

pub async fn trash_node(pool: &DbPool, user_id: i64, path_str: &str) -> Result<()> {
    let node_id = get_path_id(pool, user_id, Path::new(path_str)).await?.ok_or_else(|| anyhow!("Node not found"))?;
    sqlx::query("UPDATE files SET is_trashed = TRUE, trashed_at = ? WHERE id = ? AND owner_id = ?")
        .bind(Utc::now())
        .bind(node_id)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_trash(pool: &DbPool, user_id: i64) -> Result<Vec<TrashedFileNode>> {
    let items = sqlx::query_as(
        "SELECT id, name, original_path, trashed_at FROM files WHERE owner_id = ? AND is_trashed = TRUE ORDER BY trashed_at DESC"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(items)
}

pub async fn restore_node(pool: &DbPool, user_id: i64, node_id: i64) -> Result<String> {
    let (original_path,): (String,) = sqlx::query_as("SELECT original_path FROM files WHERE id = ? AND owner_id = ?")
        .bind(node_id)
        .bind(user_id)
        .fetch_one(pool)
        .await?;
    
    sqlx::query("UPDATE files SET is_trashed = FALSE, trashed_at = NULL WHERE id = ?")
        .bind(node_id)
        .execute(pool)
        .await?;

    Ok(original_path)
}

pub async fn permanently_delete_node(pool: &DbPool, user_id: i64, node_id: i64) -> Result<()> {
    let row = sqlx::query("SELECT disk_path FROM files WHERE id = ? AND owner_id = ? AND is_trashed = TRUE")
        .bind(node_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await?;
    
    if let Some(row) = row {
        if let Ok(Some(disk_path)) = row.try_get::<Option<String>, _>("disk_path") {
            let _ = fs::remove_file(disk_path).await;
        }
        sqlx::query("DELETE FROM files WHERE id = ?").bind(node_id).execute(pool).await?;
    }
    Ok(())
}

pub async fn empty_trash(pool: &DbPool, user_id: i64) -> Result<()> {
     let trashed_files = sqlx::query_as::<_, (i64, Option<String>)>("SELECT id, disk_path FROM files WHERE owner_id = ? AND is_trashed = TRUE")
        .bind(user_id)
        .fetch_all(pool)
        .await?;
    
    let mut tx = pool.begin().await?;
    for (id, disk_path) in trashed_files {
        if let Some(path) = disk_path {
            let _ = fs::remove_file(path).await;
        }
        sqlx::query("DELETE FROM files WHERE id = ?").bind(id).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn move_node(pool: &DbPool, user_id: i64, old_path_str: &str, new_path_str: &str) -> Result<()> {
    let old_path = Path::new(old_path_str);
    let new_path = Path::new(new_path_str);

    let node_id = get_path_id(pool, user_id, old_path).await?.ok_or_else(|| anyhow!("Source not found"))?;
    
    let new_parent_path = new_path.parent().unwrap_or(Path::new("/"));
    let new_name = new_path.file_name().and_then(|s| s.to_str()).ok_or_else(|| anyhow!("Invalid new path"))?;
    let new_parent_id = get_path_id(pool, user_id, new_parent_path).await?;

    sqlx::query("UPDATE files SET parent_id = ?, name = ?, original_path = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
        .bind(new_parent_id)
        .bind(new_name)
        .bind(new_path_str)
        .bind(Utc::now())
        .bind(node_id)
        .bind(user_id)
        .execute(pool)
        .await?;
        
    Ok(())
}

async fn get_path_id(pool: &DbPool, user_id: i64, path: &Path) -> Result<Option<i64>> {
    let components: Vec<&str> = path.to_str().unwrap_or("").split('/').filter(|&s| !s.is_empty()).collect();
    let mut current_id: Option<i64> = None;
    for component in components {
        let result: Option<(i64,)> = sqlx::query_as(
            "SELECT id FROM files WHERE owner_id = ? AND parent_id IS ? AND name = ? AND is_trashed = FALSE",
        )
        .bind(user_id)
        .bind(current_id)
        .bind(component)
        .fetch_optional(pool)
        .await?;
        
        current_id = result.map(|(id,)| id);
        if current_id.is_none() { return Ok(None); }
    }
    Ok(current_id)
}

pub fn resolve_path(cwd: &Path, target: &str, home: &str) -> PathBuf {
    let mut new_path = if target.starts_with('/') {
        PathBuf::from(target)
    } else if target == "~" {
        PathBuf::from(home)
    } else if target.starts_with("~/") {
        PathBuf::from(home).join(&target[2..])
    } else {
        cwd.join(target)
    };

    let mut components = Vec::new();
    for component in new_path.components() {
        match component {
            std::path::Component::Normal(name) => components.push(name.to_str().unwrap()),
            std::path::Component::ParentDir => { components.pop(); },
            _ => {}
        }
    }
    
    let mut result = PathBuf::from("/");
    for component in components {
        result.push(component);
    }
    result
}
