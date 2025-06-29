use keyring::Entry;
use std::path::Path;
use tokio::fs;

mod gemini;
use gemini::GeminiClient;

mod srt_utils;
use srt_utils::extract_srt_content;

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
async fn transcribe_audio(file_path: String, max_chars_per_subtitle: u32, enable_speaker_detection: bool, duration_ms: Option<u32>, model: Option<String>, api_key: String) -> Result<String, String> {
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

    // Generate prompt based on model type
    let prompt = if selected_model.contains("gemini-2.0-flash") {
        // Basic transcription prompt for initial transcription
        "音声ファイルの内容を文字起こししてください。\n\n# 目的\nこの文字起こしは、会話のトピック分析と専門用語辞書作成のために使用します。\n\n# 要求事項\n1. **話者の発言を正確に文字起こし**\n2. **フィラーワード（えーっと、あのー等）も含めて全て記録**\n3. **専門用語や固有名詞は正確に記録**\n4. **会話の流れや文脈がわかるように**\n\n# 出力形式\n- プレーンテキストで出力\n- 話者が複数いる場合は「話者1:」「話者2:」等で区別\n- タイムスタンプは不要\n- 改行で発言を区切る\n\n**説明や前置きは不要です。文字起こしテキストのみを出力してください。**".to_string()
    } else {
        // Full SRT prompt for direct SRT generation
        let duration_text = if let Some(duration) = duration_ms {
            format!("\n\n**音声ファイルの長さ: {}分{}秒 ({}ms)**\n音声の長さを考慮して、適切な字幕の分割と表示タイミングを決定してください。", 
                    duration / 60000, (duration % 60000) / 1000, duration)
        } else {
            String::new()
        };
        
        let speaker_text = if enable_speaker_detection {
            "\n    - **話者の区別:** 会話に複数の話者がいる場合は、各字幕の先頭に話者名を明記してください。（例: `アオイ: `、`ユーザー: `）"
        } else {
            "\n    - **話者の区別:** 話者名は付けず、純粋な発話内容のみを記録してください。"
        };
        
        format!(r#"提供する音声（または動画）ファイルの内容を、高品質なSRT（SubRip Text）ファイル形式で文字起こししてください。{}

# 1. SRTファイルの基本構造について

まず、納品していただくSRTファイルの構造について共通認識を持つために、基本的なルールを説明します。SRTファイルは、以下の4つの要素が1セットとなって構成されるテキストファイルです。

1.  **通し番号:** `1`から始まる字幕の連番です。
2.  **タイムスタンプ:** `時:分:秒,ミリ秒 --> 時:分:秒,ミリ秒` の形式で、字幕の表示開始時間と終了時間を指定します。（例: `00:01:23,456 --> 00:01:28,912`）
3.  **字幕テキスト:** 画面に表示する文章です。改行を含めず、インラインで記述してください
4.  **空行:** 各字幕ブロックを区切るための、何も書かれていない行です。必ず必要です

**【具体例】**
1
00:00:05,520 --> 00:00:08,910
これは1番目の字幕の
テキストです。

2
00:00:09,150 --> 00:00:11,300
そして、これが2番目の字幕です。

この構造を厳密に守ってファイルを作成してください。.srtファイルとして納品してください

# 2. 文字起こしの詳細なルール

上記の基本構造を踏まえ、以下の詳細なルールに従って作業を進めてください。

1.  **タイムスタンプの精度**
    - `hh:mm:ss,ms` の形式を厳守し、ミリ秒は3桁で記述してください。
    - 音声の発話タイミングと字幕の表示タイミングを正確に一致させてください。

2.  **字幕テキストの編集ルール**
    - **文字数制限:** 1つの字幕ブロック（通し番号1つにつき）のテキストは、**{}文字以内**を目安にしてください。長くなる場合は、意味の区切りが良い箇所で改行するなど、読みやすさを最優先してください。
    - **フィラーワードの削除:** 会話中の「えーっと」「あのー」「なんか」といった、意味を持たないフィラーワードはすべて削除し、自然で聞き取りやすい文章にしてください。{}

3.  **品質要求**
    - 字幕として読みやすく、視聴者にとって理解しやすい文章にしてください。
    - 音声が不明瞭な部分は [不明瞭] として記録してください。
    - 無音部分や間は適切に反映し、字幕の切り替えタイミングを自然にしてください。

**時間の精度が重要です。時間が合っているか確認をしたのち、最終的にSRT形式のテキストのみを出力してください。説明や前置きは不要です。**"#, duration_text, max_chars_per_subtitle, speaker_text)
    };

    // Generate transcription
    let raw_transcription = client.generate_content(&file_info.uri, &file_info.mime_type, &prompt, &selected_model).await
        .map_err(|e| format!("Failed to generate transcription: {}", e))?;

    // Extract SRT content, removing any code block markers
    let transcription = extract_srt_content(&raw_transcription);

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
    let prompt = format!("以下の文字起こしテキストを分析して、会話の主なトピックを特定してください。\n\n# 文字起こしテキスト\n{}\n\n# 要求事項\n**頻出する専門用語や固有名詞をリストアップ**\n\n# 出力形式\nキーワード: [重要な用語をカンマ区切り]\n\n**簡潔に出力してください。**", transcription);
    
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
        "{}に出てくる用語の辞書を構築して。\n表記、ふりがなのみをセットでcsv形式で記載してください。topic自体に誤字脱字がないか確認してから、辞書を作成してください。\n日本語話者がわかるような辞書にしてください。固有名詞は正式な表記が何か調べてください。\n**「自己紹介と職務経歴に関するIT分野の用語集ですね。..に関する用語を調べ、CSV形式で出力します」といった説明や補足、```csv ... ```のようなコードブロックの囲いなどCSVと関係ないものは一切禁止されています。CSVデータのみを出力してください。**", 
        topic
    );
    
    let (dictionary, search_info) = client.generate_text_content_with_search(&prompt, "gemini-2.5-pro-preview-06-05").await
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
        r#"提供する音声（または動画）ファイルの内容を、高品質なSRT（SubRip Text）ファイル形式で文字起こししてください。{}

# 専門用語辞書
以下の辞書を参考に、専門用語の表記を統一してください：

{}

# 元の文字起こし
{}

# 1. SRTファイルの基本構造について

まず、納品していただくSRTファイルの構造について共通認識を持つために、基本的なルールを説明します。SRTファイルは、以下の4つの要素が1セットとなって構成されるテキストファイルです。

1.  **通し番号:** `1`から始まる字幕の連番です。
2.  **タイムスタンプ:** `時:分:秒,ミリ秒 --> 時:分:秒,ミリ秒` の形式で、字幕の表示開始時間と終了時間を指定します。（例: `00:01:23,456 --> 00:01:28,912`）
3.  **字幕テキスト:** 画面に表示する文章です。改行を含めず、インラインで記述してください
4.  **空行:** 各字幕ブロックを区切るための、何も書かれていない行です。必ず必要です

**【具体例】**
1
00:00:05,520 --> 00:00:08,910
これは1番目の字幕の
テキストです。

2
00:00:09,150 --> 00:00:11,300
そして、これが2番目の字幕です。

この構造を厳密に守ってファイルを作成してください。.srtファイルとして納品してください

# 2. 文字起こしの詳細なルール

上記の基本構造を踏まえ、以下の詳細なルールに従って作業を進めてください。

1.  **タイムスタンプの精度**
    - `hh:mm:ss,ms` の形式を厳守し、ミリ秒は3桁で記述してください。
    - 音声の発話タイミングと字幕の表示タイミングを正確に一致させてください。

2.  **字幕テキストの編集ルール**
    - **文字数制限:** 1つの字幕ブロック（通し番号1つにつき）のテキストは、**{}文字以内**を目安にしてください。長くなる場合は、意味の区切りが良い箇所で改行するなど、読みやすさを最優先してください。
    - **フィラーワードの削除:** 会話中の「えーっと」「あのー」「なんか」といった、意味を持たないフィラーワードはすべて削除し、自然で聞き取りやすい文章にしてください。{}

3.  **品質要求**
    - 字幕として読みやすく、視聴者にとって理解しやすい文章にしてください。
    - 音声が不明瞭な部分は [不明瞭] として記録してください。
    - 無音部分や間は適切に反映し、字幕の切り替えタイミングを自然にしてください。

**時間の精度が重要です。時間が合っているか確認をしたのち、最終的にSRT形式のテキストのみを出力してください。説明や前置きは不要です。**
"#,
        duration_text,
        dictionary,
        initial_transcription,
        max_chars_per_subtitle,
        if enable_speaker_detection { 
            "\n    - **話者の区別:** 会話に複数の話者がいる場合は、各字幕の先頭に話者名を明記してください。（例: `アオイ: `、`ユーザー: `）" 
        } else { 
            "\n    - **話者の区別:** 話者名は付けず、純粋な発話内容のみを記録してください。" 
        }
    );
    
    let raw_enhanced_result = client.generate_text_content(&prompt, "gemini-2.5-pro-preview-06-05").await
        .map_err(|e| format!("Failed to enhance transcription: {}", e))?;

    // Extract SRT content, removing any code block markers
    let enhanced_result = extract_srt_content(&raw_enhanced_result);

    Ok(enhanced_result)
}

#[tauri::command]
async fn save_dictionary_csv(content: String, suggestedFilename: String) -> Result<String, String> {
    println!("save_dictionary_csv called with filename: {}, content length: {}", suggestedFilename, content.len());
    
    // ダウンロードフォルダに辞書CSVを保存
    let downloads_dir = dirs::download_dir()
        .ok_or("Could not find downloads directory")?;
    
    println!("Downloads directory: {:?}", downloads_dir);
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let base_name = suggestedFilename.trim_end_matches(".csv");
    // ファイル名から不正な文字を除去
    let safe_base_name = base_name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c
        })
        .collect::<String>();
    let unique_filename = format!("{}_dictionary_{}.csv", safe_base_name, timestamp);
    let file_path = downloads_dir.join(&unique_filename);
    
    println!("Attempting to write dictionary file to: {:?}", file_path);
    
    fs::write(&file_path, content.as_bytes()).await
        .map_err(|e| {
            println!("Failed to write dictionary file: {}", e);
            format!("Failed to write dictionary file: {}", e)
        })?;
    
    println!("Dictionary file written successfully");
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
async fn save_srt_file(content: String, suggestedFilename: String) -> Result<String, String> {
    println!("save_srt_file called with filename: {}, content length: {}", suggestedFilename, content.len());
    
    // For now, let's use a simple approach - save to Downloads folder
    let downloads_dir = dirs::download_dir()
        .ok_or("Could not find downloads directory")?;
    
    println!("Downloads directory: {:?}", downloads_dir);
    
    // Create unique filename to avoid conflicts
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let base_name = suggestedFilename.trim_end_matches(".srt");
    // ファイル名から不正な文字を除去
    let safe_base_name = base_name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c
        })
        .collect::<String>();
    let unique_filename = format!("{}_{}.srt", safe_base_name, timestamp);
    let file_path = downloads_dir.join(&unique_filename);
    
    println!("Attempting to write file to: {:?}", file_path);
    
    // Write the content to the file
    fs::write(&file_path, content.as_bytes()).await
        .map_err(|e| {
            println!("Failed to write file: {}", e);
            format!("Failed to write file: {}", e)
        })?;
    
    println!("File written successfully");
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
