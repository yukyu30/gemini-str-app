use keyring::Entry;
use std::path::Path;
use tokio::fs;
use tauri::{Manager, AppHandle};

mod gemini;
use gemini::GeminiClient;

const SERVICE_NAME: &str = "gemini-str-app";
const API_KEY_ENTRY: &str = "gemini_api_key";

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn set_api_key(api_key: String) -> Result<bool, String> {
    println!("DEBUG: Attempting to save API key, length: {}", api_key.len());
    
    if api_key.trim().is_empty() {
        println!("DEBUG: API key is empty");
        return Err("API key cannot be empty".to_string());
    }

    let entry = Entry::new(SERVICE_NAME, API_KEY_ENTRY)
        .map_err(|e| {
            println!("DEBUG: Failed to create keyring entry: {}", e);
            format!("Failed to create keyring entry: {}", e)
        })?;
    
    match entry.set_password(&api_key) {
        Ok(_) => {
            println!("DEBUG: Successfully saved API key to keyring");
            
            // Verify the save immediately
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            match entry.get_password() {
                Ok(saved_key) => {
                    println!("DEBUG: Verification read successful, length: {}", saved_key.len());
                    Ok(true)
                },
                Err(e) => {
                    println!("DEBUG: Verification read failed: {}", e);
                    // Still return success since the save operation succeeded
                    Ok(true)
                }
            }
        },
        Err(e) => {
            println!("DEBUG: Failed to save API key: {}", e);
            Err(format!("Failed to store API key: {}", e))
        }
    }
}

#[tauri::command]
async fn get_api_key() -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, API_KEY_ENTRY)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    match entry.get_password() {
        Ok(password) => Ok(password),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(format!("Failed to retrieve API key: {}", e)),
    }
}

#[tauri::command]
async fn delete_api_key() -> Result<bool, String> {
    let entry = Entry::new(SERVICE_NAME, API_KEY_ENTRY)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    match entry.delete_credential() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(true), // Already deleted
        Err(e) => Err(format!("Failed to delete API key: {}", e)),
    }
}

#[tauri::command]
async fn get_api_key_preview() -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, API_KEY_ENTRY)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    match entry.get_password() {
        Ok(password) => {
            println!("DEBUG: Retrieved password, length: {}", password.len());
            if password.trim().is_empty() {
                println!("DEBUG: Password is empty");
                Ok(String::new())
            } else if password.len() > 4 {
                let preview = format!("****{}", &password[password.len()-4..]);
                println!("DEBUG: Generated preview: {}", preview);
                Ok(preview)
            } else {
                println!("DEBUG: Password too short, using ****");
                Ok("****".to_string())
            }
        },
        Err(keyring::Error::NoEntry) => {
            println!("DEBUG: No entry found in keyring");
            Ok(String::new())
        },
        Err(e) => {
            println!("DEBUG: Keyring error: {}", e);
            Err(format!("Failed to retrieve API key: {}", e))
        },
    }
}

#[tauri::command]
async fn debug_keyring() -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, API_KEY_ENTRY)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    match entry.get_password() {
        Ok(password) => {
            Ok(format!("Found API key, length: {}, first 10 chars: {}", 
                password.len(), 
                if password.len() > 10 { &password[0..10] } else { &password }))
        },
        Err(keyring::Error::NoEntry) => Ok("No API key found in keyring".to_string()),
        Err(e) => Err(format!("Keyring error: {}", e)),
    }
}

#[tauri::command]
async fn transcribe_audio(file_path: String, prompt: String, model: Option<String>, api_key: String) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("API key is empty. Please set your Gemini API key in settings.".to_string());
    }

    // Validate file exists
    if !Path::new(&file_path).exists() {
        return Err("Audio file not found".to_string());
    }

    // Guess MIME type
    let mime_type = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    // Create Gemini client
    let client = GeminiClient::new(api_key);

    // Upload file to Gemini Files API
    let file_info = client.upload_file(&file_path, &mime_type).await
        .map_err(|e| format!("Failed to upload file: {}", e))?;

    // Wait for file processing
    client.wait_for_file_processing(&file_info.name).await
        .map_err(|e| format!("File processing failed: {}", e))?;

    // Use provided model or default to gemini-2.0-flash
    let selected_model = model.unwrap_or_else(|| "gemini-2.0-flash".to_string());

    // Generate transcription
    let transcription = client.generate_content(&file_info.uri, &file_info.mime_type, &prompt, &selected_model).await
        .map_err(|e| format!("Failed to generate transcription: {}", e))?;

    Ok(transcription)
}

#[tauri::command]
async fn get_transcription_progress() -> Result<String, String> {
    // This could be enhanced to track upload/processing progress
    Ok("Processing...".to_string())
}

#[tauri::command]
async fn save_temp_file(file_data: Vec<u8>, file_name: String) -> Result<String, String> {
    // Get the file extension from the original filename
    let extension = Path::new(&file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("bin");
    
    // Create a new temp file with the correct extension
    let temp_dir = std::env::temp_dir();
    let temp_file_path = temp_dir.join(format!("audio_temp_{}.{}", 
        uuid::Uuid::new_v4().to_string(), extension));
    
    // Write the file data
    fs::write(&temp_file_path, file_data).await
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    
    // Return the path as string
    Ok(temp_file_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            set_api_key,
            get_api_key,
            get_api_key_preview,
            delete_api_key,
            debug_keyring,
            transcribe_audio,
            get_transcription_progress,
            save_temp_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
