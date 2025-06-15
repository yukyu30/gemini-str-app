use keyring::Entry;
use std::path::Path;
use tokio::fs;

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
async fn analyze_topic(transcription: String, api_key: String) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("API key is empty".to_string());
    }

    let client = GeminiClient::new(api_key);
    
    // トピック分析用プロンプト
    let prompt = format!("以下の文字起こしテキストを分析して、会話の主なトピックを特定してください。\n\n# 文字起こしテキスト\n{}\n\n# 要求事項\n1. **会話の主要テーマを1-3個特定**\n2. **専門分野（IT、医療、法律、ビジネス、学術等）があれば特定**\n3. **頻出する専門用語や固有名詞をリストアップ**\n\n# 出力形式\nメイントピック: [トピック名]\n専門分野: [分野名]\nキーワード: [重要な用語をカンマ区切り]\n\n**簡潔に出力してください。**", transcription);
    
    let analysis = client.generate_text_content(&prompt, "gemini-2.0-flash").await
        .map_err(|e| format!("Failed to analyze topic: {}", e))?;

    Ok(analysis)
}

#[tauri::command]
async fn create_dictionary(topic: String, api_key: String) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("API key is empty".to_string());
    }

    let client = GeminiClient::new(api_key);
    
    // Google検索を使って正確な情報を取得した辞書作成用プロンプト
    let prompt = format!(
        "{}に関する専門用語の辞書を作成してください。\n\n# 要求事項\n1. Googleで最新の情報を検索して、用語の正確性を確認してください\n2. 表記とふりがなのペアをCSV形式で出力してください\n3. 日本語話者が理解しやすい辞書にしてください\n4. 専門分野で一般的に使われる正式な用語を優先してください\n5. 略語がある場合は正式名称も含めてください\n\n# 出力形式\n表記,ふりがな\n例: データベース,データベース\n例: API,エーピーアイ\n\n**CSVヘッダーは含めず、データのみを出力してください**", 
        topic
    );
    
    let (dictionary, search_info) = client.generate_text_content_with_search(&prompt, "gemini-2.0-flash").await
        .map_err(|e| format!("Failed to create dictionary with search: {}", e))?;

    // 検索情報をログに出力（デバッグ用）
    if let Some(search_content) = search_info {
        println!("Search grounding info: {}", search_content);
    }

    Ok(dictionary)
}

#[tauri::command]
async fn enhance_transcription_with_dictionary(
    initial_transcription: String, 
    dictionary: String, 
    max_chars_per_subtitle: u32,
    enable_speaker_detection: bool,
    duration_ms: Option<u32>,
    api_key: String
) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("API key is empty".to_string());
    }

    let client = GeminiClient::new(api_key);
    
    // 既存の文字起こしを辞書を使ってSRT形式に変換するプロンプト
    let duration_text = if let Some(duration) = duration_ms {
        format!("**音声ファイルの長さ: {}分{}秒 ({}ms)**\n音声の長さを考慮して、適切な字幕の分割と表示タイミングを決定してください。\n\n", 
                duration / 60000, (duration % 60000) / 1000, duration)
    } else {
        String::new()
    };
    
    let prompt = format!(
        r#"以下の文字起こしテキストを、高品質なSRT（SubRip Text）ファイル形式に変換してください。

{}# 元の文字起こし
{}

# 専門用語辞書
以下の辞書を参考に、専門用語の表記を統一してください：

{}

# SRT変換ルール
1. **タイムスタンプの生成**: 文字起こしの内容から適切な時間を推定して `00:00:00,000 --> 00:00:00,000` 形式で作成
2. **文字数制限**: 1つの字幕ブロックは{}文字以内
3. **フィラーワード削除**: 「えーっと」「あのー」等を削除
4. **話者識別**: {}
5. **SRT番号**: 1から始まる連番

# 出力形式
SRT形式のテキストのみを出力してください。説明や前置きは不要です。

例:
1
00:00:01,000 --> 00:00:04,000
最初の字幕テキスト

2
00:00:05,000 --> 00:00:08,000
二番目の字幕テキスト
"#,
        duration_text,
        initial_transcription,
        dictionary,
        max_chars_per_subtitle,
        if enable_speaker_detection { 
            "各字幕の先頭に話者名を明記してください（例: `田中: `、`ユーザー: `）" 
        } else { 
            "話者名は付けず、純粋な発話内容のみを記録してください" 
        }
    );
    
    let enhanced_result = client.generate_text_content(&prompt, "gemini-2.5-pro-preview-06-05").await
        .map_err(|e| format!("Failed to enhance transcription: {}", e))?;

    Ok(enhanced_result)
}

#[tauri::command]
async fn save_dictionary_csv(content: String, suggested_filename: String) -> Result<String, String> {
    // ダウンロードフォルダに辞書CSVを保存
    let downloads_dir = dirs::download_dir()
        .ok_or("Could not find downloads directory")?;
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let base_name = suggested_filename.trim_end_matches(".csv");
    let unique_filename = format!("{}_dictionary_{}.csv", base_name, timestamp);
    let file_path = downloads_dir.join(&unique_filename);
    
    fs::write(&file_path, content.as_bytes()).await
        .map_err(|e| format!("Failed to write dictionary file: {}", e))?;
    
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn load_dictionary_csv(file_path: String) -> Result<String, String> {
    // CSVファイルを読み込み
    if !Path::new(&file_path).exists() {
        return Err("Dictionary file not found".to_string());
    }
    
    let content = fs::read_to_string(&file_path).await
        .map_err(|e| format!("Failed to read dictionary file: {}", e))?;
    
    Ok(content)
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

#[tauri::command]
async fn save_srt_file(content: String, suggested_filename: String) -> Result<String, String> {
    // For now, let's use a simple approach - save to Downloads folder
    let downloads_dir = dirs::download_dir()
        .ok_or("Could not find downloads directory")?;
    
    // Create unique filename to avoid conflicts
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let base_name = suggested_filename.trim_end_matches(".srt");
    let unique_filename = format!("{}_{}.srt", base_name, timestamp);
    let file_path = downloads_dir.join(&unique_filename);
    
    // Write the content to the file
    fs::write(&file_path, content.as_bytes()).await
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(file_path.to_string_lossy().to_string())
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
            analyze_topic,
            create_dictionary,
            enhance_transcription_with_dictionary,
            save_dictionary_csv,
            load_dictionary_csv,
            get_transcription_progress,
            save_temp_file,
            save_srt_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
