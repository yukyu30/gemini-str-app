/// Utility functions for handling SRT content
pub fn extract_srt_content(response: &str) -> String {
    // Check if the response contains code block markers
    if response.contains("```srt") || response.contains("```") {
        // Extract content between code blocks
        let mut in_code_block = false;
        let mut is_srt_block = false;
        let mut extracted_content = String::new();
        let mut all_content = String::new();
        
        for line in response.lines() {
            if line.trim().starts_with("```srt") {
                // If we already have content, return it (first SRT block only)
                if !extracted_content.is_empty() {
                    break;
                }
                in_code_block = true;
                is_srt_block = true;
                continue;
            } else if line.trim() == "```" {
                if in_code_block {
                    in_code_block = false;
                    if is_srt_block && !extracted_content.is_empty() {
                        // Found end of SRT block, stop here
                        break;
                    }
                    is_srt_block = false;
                } else {
                    // Starting a generic code block
                    if extracted_content.is_empty() {
                        in_code_block = true;
                    }
                }
                continue;
            }
            
            if in_code_block {
                if is_srt_block {
                    extracted_content.push_str(line);
                    extracted_content.push('\n');
                } else {
                    all_content.push_str(line);
                    all_content.push('\n');
                }
            }
        }
        
        // If we extracted SRT content, return it trimmed
        if !extracted_content.is_empty() {
            return extracted_content.trim().to_string();
        }
        
        // If we have generic code block content, return it
        if !all_content.is_empty() {
            return all_content.trim().to_string();
        }
    }
    
    // If no code blocks found or extraction failed, return the original trimmed
    response.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_srt_no_code_block() {
        let input = "1\n00:00:00,000 --> 00:00:05,000\nHello World\n\n2\n00:00:05,000 --> 00:00:10,000\nThis is a test";
        let result = extract_srt_content(input);
        assert_eq!(result, input);
    }

    #[test]
    fn test_extract_srt_with_srt_code_block() {
        let input = "Here is the SRT content:\n\n```srt\n1\n00:00:00,000 --> 00:00:05,000\nHello World\n\n2\n00:00:05,000 --> 00:00:10,000\nThis is a test\n```\n\nThat's all!";
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nHello World\n\n2\n00:00:05,000 --> 00:00:10,000\nThis is a test";
        let result = extract_srt_content(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_extract_srt_with_generic_code_block() {
        let input = "```\n1\n00:00:00,000 --> 00:00:05,000\nHello World\n```";
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nHello World";
        let result = extract_srt_content(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_extract_srt_with_multiple_code_blocks() {
        let input = "First block:\n```srt\n1\n00:00:00,000 --> 00:00:05,000\nFirst\n```\n\nSecond block:\n```\n2\n00:00:05,000 --> 00:00:10,000\nSecond\n```";
        // Should extract only the first SRT block
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nFirst";
        let result = extract_srt_content(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_extract_srt_with_surrounding_text() {
        let input = "I've generated the following SRT file for you:\n\n```srt\n1\n00:00:00,000 --> 00:00:05,000\nHello\n```\n\nPlease review it.";
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nHello";
        let result = extract_srt_content(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_extract_srt_empty_code_block() {
        let input = "```srt\n```";
        // When code block is empty, it falls back to returning the original
        let expected = "```srt\n```";
        let result = extract_srt_content(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_extract_srt_with_whitespace() {
        let input = "  Here is the content:  \n\n```srt\n1\n00:00:00,000 --> 00:00:05,000\nHello\n```  \n  ";
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nHello";
        let result = extract_srt_content(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_extract_srt_with_explanation_after() {
        let input = "```srt\n1\n00:00:00,000 --> 00:00:05,000\nHello World\n```\n\nThis SRT file contains a simple greeting.";
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nHello World";
        let result = extract_srt_content(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_extract_srt_with_backticks_in_content() {
        // Test case where SRT content might contain backticks as part of dialogue
        let input = "```srt\n1\n00:00:00,000 --> 00:00:05,000\nHe said `hello` to me\n```";
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nHe said `hello` to me";
        let result = extract_srt_content(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_extract_srt_real_world_example() {
        let input = r#"I've generated the SRT subtitles for your audio file:

```srt
1
00:00:00,520 --> 00:00:03,910
これは最初の字幕です

2
00:00:04,150 --> 00:00:07,300
そして、これが2番目の字幕です
```

The subtitles have been properly timed and formatted."#;
        let expected = "1\n00:00:00,520 --> 00:00:03,910\nこれは最初の字幕です\n\n2\n00:00:04,150 --> 00:00:07,300\nそして、これが2番目の字幕です";
        let result = extract_srt_content(input);
        assert_eq!(result, expected);
    }
}