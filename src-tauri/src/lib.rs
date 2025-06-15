use keyring::Entry;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            set_api_key,
            get_api_key,
            delete_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
