use keyring::Entry;
use std::path::Path;

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
    if api_key.trim().is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    let entry = Entry::new(SERVICE_NAME, API_KEY_ENTRY)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    entry.set_password(&api_key)
        .map_err(|e| format!("Failed to store API key: {}", e))?;
    
    Ok(true)
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
async fn transcribe_audio(file_path: String, prompt: String, model: Option<String>) -> Result<String, String> {
    // Get API key
    let entry = Entry::new(SERVICE_NAME, API_KEY_ENTRY)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    let api_key = match entry.get_password() {
        Ok(password) => password,
        Err(keyring::Error::NoEntry) => return Err("API key not found. Please set your Gemini API key in settings.".to_string()),
        Err(e) => return Err(format!("Failed to retrieve API key: {}", e)),
    };

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            set_api_key,
            get_api_key,
            delete_api_key,
            transcribe_audio,
            get_transcription_progress
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
