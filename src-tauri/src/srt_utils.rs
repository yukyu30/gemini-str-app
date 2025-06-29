/// Extracts SRT content from text that may contain markdown code blocks
pub fn extract_srt_content(text: &str) -> &str {
    // Pattern to match ```srt ... ``` blocks
    if let Some(start) = text.find("```srt") {
        if let Some(end) = text[start + 6..].find("```") {
            let content_start = start + 6;
            let content_end = content_start + end;
            
            // Skip any whitespace/newline after ```srt and trim trailing whitespace
            let content = &text[content_start..content_end];
            return content.trim();
        }
    }
    
    // Pattern to match generic ``` ... ``` blocks
    if let Some(start) = text.find("```") {
        if let Some(end) = text[start + 3..].find("```") {
            let content_start = start + 3;
            let content_end = content_start + end;
            
            // Skip any whitespace/newline after ``` and trim trailing whitespace
            let content = &text[content_start..content_end];
            return content.trim();
        }
    }
    
    // Return original text if no code blocks found
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_srt_with_code_block() {
        let input = "```srt\n1\n00:00:00,000 --> 00:00:05,000\nHello world\n```";
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nHello world";
        assert_eq!(extract_srt_content(input), expected);
    }

    #[test]
    fn test_extract_generic_code_block() {
        let input = "```\n1\n00:00:00,000 --> 00:00:05,000\nHello world\n```";
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nHello world";
        assert_eq!(extract_srt_content(input), expected);
    }

    #[test]
    fn test_no_code_block() {
        let input = "1\n00:00:00,000 --> 00:00:05,000\nHello world";
        assert_eq!(extract_srt_content(input), input);
    }

    #[test]
    fn test_empty_code_block() {
        let input = "```srt\n```";
        assert_eq!(extract_srt_content(input), "");
    }

    #[test]
    fn test_multiple_code_blocks() {
        let input = "Some text\n```srt\n1\n00:00:00,000 --> 00:00:05,000\nFirst subtitle\n```\nMore text\n```\n2\n00:00:05,000 --> 00:00:10,000\nSecond subtitle\n```";
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nFirst subtitle";
        assert_eq!(extract_srt_content(input), expected);
    }

    #[test]
    fn test_code_block_with_extra_whitespace() {
        let input = "```srt\n\n\n1\n00:00:00,000 --> 00:00:05,000\nHello world\n\n```";
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nHello world";
        assert_eq!(extract_srt_content(input), expected);
    }

    #[test]
    fn test_incomplete_code_block() {
        let input = "```srt\n1\n00:00:00,000 --> 00:00:05,000\nHello world";
        assert_eq!(extract_srt_content(input), input);
    }

    #[test]
    fn test_nested_backticks_in_content() {
        let input = "```srt\n1\n00:00:00,000 --> 00:00:05,000\nHe said `hello` to me\n```";
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nHe said `hello` to me";
        assert_eq!(extract_srt_content(input), expected);
    }

    #[test]
    fn test_japanese_content() {
        let input = "```srt\n1\n00:00:00,000 --> 00:00:05,000\nこんにちは世界\n```";
        let expected = "1\n00:00:00,000 --> 00:00:05,000\nこんにちは世界";
        assert_eq!(extract_srt_content(input), expected);
    }

    #[test]
    fn test_real_world_example() {
        let input = r#"```srt
1
00:00:00,000 --> 00:00:02,500
Welcome to our presentation

2
00:00:02,500 --> 00:00:05,000
Today we'll discuss AI technology
```"#;
        let expected = "1\n00:00:00,000 --> 00:00:02,500\nWelcome to our presentation\n\n2\n00:00:02,500 --> 00:00:05,000\nToday we'll discuss AI technology";
        assert_eq!(extract_srt_content(input), expected);
    }
}