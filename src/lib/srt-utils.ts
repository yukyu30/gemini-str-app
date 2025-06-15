import { SrtSubtitle } from '@/types/srt'

export function parseSrt(srtContent: string): SrtSubtitle[] {
  const subtitles: SrtSubtitle[] = []
  const blocks = srtContent.trim().split('\n\n')
  
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue
    
    const index = parseInt(lines[0])
    const timeLine = lines[1]
    const text = lines.slice(2).join('\n')
    
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/)
    if (!timeMatch) continue
    
    subtitles.push({
      index,
      startTime: timeMatch[1],
      endTime: timeMatch[2],
      text
    })
  }
  
  return subtitles
}

export function generateSrt(subtitles: SrtSubtitle[]): string {
  return subtitles
    .map(subtitle => 
      `${subtitle.index}\n${subtitle.startTime} --> ${subtitle.endTime}\n${subtitle.text}\n`
    )
    .join('\n')
}

export function validateSrt(srtContent: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  const subtitles = parseSrt(srtContent)
  
  if (subtitles.length === 0) {
    errors.push('SRTファイルに有効な字幕が見つかりません')
    return { isValid: false, errors }
  }
  
  // インデックスの連番チェック
  for (let i = 0; i < subtitles.length; i++) {
    if (subtitles[i].index !== i + 1) {
      errors.push(`字幕 ${i + 1} のインデックスが正しくありません`)
    }
  }
  
  // タイムスタンプの形式チェック
  const timeRegex = /^\d{2}:\d{2}:\d{2},\d{3}$/
  for (const subtitle of subtitles) {
    if (!timeRegex.test(subtitle.startTime)) {
      errors.push(`字幕 ${subtitle.index} の開始時間の形式が正しくありません`)
    }
    if (!timeRegex.test(subtitle.endTime)) {
      errors.push(`字幕 ${subtitle.index} の終了時間の形式が正しくありません`)
    }
  }
  
  // 時間の論理チェック
  for (let i = 0; i < subtitles.length; i++) {
    const current = subtitles[i]
    const startSeconds = timeToSeconds(current.startTime)
    const endSeconds = timeToSeconds(current.endTime)
    
    if (startSeconds >= endSeconds) {
      errors.push(`字幕 ${current.index} の開始時間が終了時間以降になっています`)
    }
    
    if (i > 0) {
      const prev = subtitles[i - 1]
      const prevEndSeconds = timeToSeconds(prev.endTime)
      if (startSeconds < prevEndSeconds) {
        errors.push(`字幕 ${current.index} が前の字幕と重複しています`)
      }
    }
  }
  
  return { isValid: errors.length === 0, errors }
}

function timeToSeconds(timeString: string): number {
  const [time, ms] = timeString.split(',')
  const [hours, minutes, seconds] = time.split(':').map(Number)
  return hours * 3600 + minutes * 60 + seconds + Number(ms) / 1000
}

export function downloadSrtFile(content: string, filename: string) {
  const element = document.createElement('a')
  const file = new Blob([content], { type: 'application/x-subrip' })
  element.href = URL.createObjectURL(file)
  element.download = filename.endsWith('.srt') ? filename : `${filename}.srt`
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
  URL.revokeObjectURL(element.href)
}