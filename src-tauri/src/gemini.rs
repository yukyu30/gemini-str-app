use reqwest::{Client, multipart};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileUploadResponse {
    pub file: FileInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub uri: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: String,
    #[serde(rename = "createTime")]
    pub create_time: String,
    #[serde(rename = "updateTime")]
    pub update_time: String,
    #[serde(rename = "expirationTime")]
    pub expiration_time: String,
    #[serde(rename = "sha256Hash")]
    pub sha256_hash: String,
    pub state: String,
    pub source: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateContentRequest {
    pub contents: Vec<Content>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Tool {
    #[serde(rename = "googleSearch")]
    pub google_search: GoogleSearch,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleSearch {}

#[derive(Debug, Serialize, Deserialize)]
pub struct Content {
    pub parts: Vec<Part>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Part {
    Text { text: String },
    FileData { 
        #[serde(rename = "fileData")]
        file_data: FileData 
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileData {
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    #[serde(rename = "fileUri")]
    pub file_uri: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateContentResponse {
    pub candidates: Vec<Candidate>,
    #[serde(rename = "usageMetadata")]
    pub usage_metadata: Option<UsageMetadata>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Candidate {
    pub content: Content,
    #[serde(rename = "finishReason")]
    pub finish_reason: Option<String>,
    pub index: Option<i32>,
    #[serde(rename = "safetyRatings")]
    pub safety_ratings: Option<Vec<SafetyRating>>,
    #[serde(rename = "groundingMetadata")]
    pub grounding_metadata: Option<GroundingMetadata>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroundingMetadata {
    #[serde(rename = "searchEntryPoint")]
    pub search_entry_point: Option<SearchEntryPoint>,
    #[serde(rename = "groundingChunks")]
    pub grounding_chunks: Option<Vec<GroundingChunk>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchEntryPoint {
    #[serde(rename = "renderedContent")]
    pub rendered_content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroundingChunk {
    pub web: Option<WebChunk>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WebChunk {
    pub uri: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SafetyRating {
    pub category: String,
    pub probability: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UsageMetadata {
    #[serde(rename = "promptTokenCount")]
    pub prompt_token_count: Option<i32>,
    #[serde(rename = "candidatesTokenCount")]
    pub candidates_token_count: Option<i32>,
    #[serde(rename = "totalTokenCount")]
    pub total_token_count: Option<i32>,
}

pub struct GeminiClient {
    client: Client,
    api_key: String,
    base_url: String,
}

impl GeminiClient {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
            base_url: "https://generativelanguage.googleapis.com".to_string(),
        }
    }

    pub async fn upload_file(&self, file_path: &str, mime_type: &str) -> Result<FileInfo, Box<dyn std::error::Error>> {
        let file_data = fs::read(file_path).await?;
        let file_name = Path::new(file_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("audio_file");

        let form = multipart::Form::new()
            .part("metadata", multipart::Part::text(
                serde_json::to_string(&serde_json::json!({
                    "file": {
                        "displayName": file_name
                    }
                }))?
            ))
            .part("data", multipart::Part::bytes(file_data)
                .file_name(file_name.to_string())
                .mime_str(mime_type)?);

        let url = format!("{}/upload/v1beta/files?key={}", self.base_url, self.api_key);
        
        let response = self.client
            .post(&url)
            .multipart(form)
            .header("X-Goog-Upload-Protocol", "multipart")
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await?;
            eprintln!("File upload failed with status {}: {}", status, error_text);
            return Err(format!("File upload failed ({}): {}", status, error_text).into());
        }

        let response_text = response.text().await?;
        eprintln!("Upload response: {}", response_text);
        
        let upload_response: FileUploadResponse = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse upload response: {} - Response: {}", e, response_text))?;
        Ok(upload_response.file)
    }

    pub async fn generate_content(&self, file_uri: &str, mime_type: &str, prompt: &str, model: &str) -> Result<String, Box<dyn std::error::Error>> {
        let request = GenerateContentRequest {
            contents: vec![Content {
                parts: vec![
                    Part::FileData {
                        file_data: FileData {
                            mime_type: mime_type.to_string(),
                            file_uri: file_uri.to_string(),
                        }
                    },
                    Part::Text {
                        text: prompt.to_string(),
                    }
                ],
            }],
            tools: None,
        };

        // Remove "models/" prefix if it exists, as we'll add it in the URL
        let model_name = if model.starts_with("models/") {
            &model[7..] // Remove "models/" prefix
        } else {
            model
        };
        let url = format!("{}/v1beta/models/{}:generateContent?key={}", self.base_url, model_name, self.api_key);
        
        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await?;
            eprintln!("Content generation failed with status {}: {}", status, error_text);
            return Err(format!("Content generation failed ({}): {}", status, error_text).into());
        }

        let response_text = response.text().await?;
        eprintln!("Generate content response: {}", response_text);
        
        let generate_response: GenerateContentResponse = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse generation response: {} - Response: {}", e, response_text))?;
        
        if let Some(candidate) = generate_response.candidates.first() {
            if let Some(Part::Text { text }) = candidate.content.parts.first() {
                return Ok(text.clone());
            }
        }

        Err("No text content found in response".into())
    }

    pub async fn wait_for_file_processing(&self, file_name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let url = format!("{}/v1beta/{}?key={}", self.base_url, file_name, self.api_key);
        
        for _ in 0..30 { // Wait up to 30 seconds
            let response = self.client.get(&url).send().await?;
            
            if response.status().is_success() {
                let file_info: FileInfo = response.json().await?;
                
                match file_info.state.as_str() {
                    "ACTIVE" => return Ok(()),
                    "FAILED" => return Err("File processing failed".into()),
                    _ => {
                        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                        continue;
                    }
                }
            }
        }
        
        Err("File processing timeout".into())
    }

    pub async fn generate_text_content(&self, text: &str, model: &str) -> Result<String, Box<dyn std::error::Error>> {
        // Remove "models/" prefix if it exists, as we'll add it in the URL
        let model_name = if model.starts_with("models/") {
            &model[7..] // Remove "models/" prefix
        } else {
            model
        };
        let url = format!("{}/v1beta/models/{}:generateContent?key={}", self.base_url, model_name, self.api_key);
        
        let request = GenerateContentRequest {
            contents: vec![
                Content {
                    parts: vec![Part::Text { text: text.to_string() }],
                }
            ],
            tools: None,
        };

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("Text content generation failed ({}): {}", status, error_text).into());
        }

        let response_text = response.text().await?;
        eprintln!("Generate text content response: {}", response_text);
        
        let generate_response: GenerateContentResponse = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse text generation response: {} - Response: {}", e, response_text))?;
        
        if let Some(candidate) = generate_response.candidates.first() {
            if let Some(Part::Text { text }) = candidate.content.parts.first() {
                return Ok(text.clone());
            }
        }

        Err("No text content found in response".into())
    }

    pub async fn generate_text_content_with_search(&self, text: &str, model: &str) -> Result<(String, Option<String>), Box<dyn std::error::Error>> {
        // Remove "models/" prefix if it exists, as we'll add it in the URL
        let model_name = if model.starts_with("models/") {
            &model[7..] // Remove "models/" prefix
        } else {
            model
        };
        let url = format!("{}/v1beta/models/{}:generateContent?key={}", self.base_url, model_name, self.api_key);
        
        let request = GenerateContentRequest {
            contents: vec![
                Content {
                    parts: vec![Part::Text { text: text.to_string() }],
                }
            ],
            tools: Some(vec![Tool {
                google_search: GoogleSearch {},
            }]),
        };

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("Text content generation with search failed ({}): {}", status, error_text).into());
        }

        let response_text = response.text().await?;
        eprintln!("Generate text content with search response: {}", response_text);
        
        let generate_response: GenerateContentResponse = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse text generation response: {} - Response: {}", e, response_text))?;
        
        if let Some(candidate) = generate_response.candidates.first() {
            let text_content = if let Some(Part::Text { text }) = candidate.content.parts.first() {
                text.clone()
            } else {
                return Err("No text content found in response".into());
            };

            let search_info = candidate.grounding_metadata.as_ref()
                .and_then(|gm| gm.search_entry_point.as_ref())
                .and_then(|sep| sep.rendered_content.as_ref())
                .cloned();

            return Ok((text_content, search_info));
        }

        Err("No candidate found in response".into())
    }
}