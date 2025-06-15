import { describe, it, expect } from 'vitest'
import { ProcessingStage } from '@/types/srt'

// Extract the stage merging logic for testing
function mergeStagesWithDefaults(
  actualStages?: {
    initialTranscription?: ProcessingStage
    topicAnalysis?: ProcessingStage
    dictionaryCreation?: ProcessingStage
    finalTranscription?: ProcessingStage
  }
) {
  const defaultStages = {
    initialTranscription: {
      name: '基本文字起こし (Gemini 2.0 Flash)',
      status: 'pending' as const,
      description: '音声ファイルから基本的な文字起こしを行います'
    },
    topicAnalysis: {
      name: 'トピック分析 (Gemini 2.0 Flash)',
      status: 'pending' as const,
      description: '文字起こし結果からトピックと主要テーマを分析します'
    },
    dictionaryCreation: {
      name: '辞書作成 (Google検索+Gemini 2.0 Flash)',
      status: 'pending' as const,
      description: 'トピックに関連する専門用語辞書をGoogle検索で作成します'
    },
    finalTranscription: {
      name: '最終字幕生成 (Gemini 2.5 Pro)',
      status: 'pending' as const,
      description: '辞書を使用して高精度なSRT字幕を生成します'
    }
  }

  return actualStages ? 
    Object.fromEntries(
      Object.entries(defaultStages).map(([key, defaultStage]) => {
        const stageKey = key as keyof typeof actualStages
        return [
          key, 
          actualStages?.[stageKey] ? {
            ...defaultStage,
            ...actualStages[stageKey]
          } : defaultStage
        ]
      })
    ) : defaultStages
}

describe('Stage Merger Logic', () => {
  it('should return default stages when no actual stages provided', () => {
    const result = mergeStagesWithDefaults()
    
    expect(result).toEqual({
      initialTranscription: {
        name: '基本文字起こし (Gemini 2.0 Flash)',
        status: 'pending',
        description: '音声ファイルから基本的な文字起こしを行います'
      },
      topicAnalysis: {
        name: 'トピック分析 (Gemini 2.0 Flash)',
        status: 'pending',
        description: '文字起こし結果からトピックと主要テーマを分析します'
      },
      dictionaryCreation: {
        name: '辞書作成 (Google検索+Gemini 2.0 Flash)',
        status: 'pending',
        description: 'トピックに関連する専門用語辞書をGoogle検索で作成します'
      },
      finalTranscription: {
        name: '最終字幕生成 (Gemini 2.5 Pro)',
        status: 'pending',
        description: '辞書を使用して高精度なSRT字幕を生成します'
      }
    })
  })

  it('should merge actual stage data with defaults, prioritizing actual data', () => {
    const actualStages = {
      initialTranscription: {
        name: '基本文字起こし (Gemini 2.0 Flash)',
        status: 'completed' as const,
        result: 'Transcription completed successfully'
      },
      topicAnalysis: {
        name: 'トピック分析 (Gemini 2.0 Flash)',
        status: 'processing' as const
      }
    }

    const result = mergeStagesWithDefaults(actualStages)
    
    // Check that completed stage retains its actual data
    expect(result.initialTranscription).toEqual({
      name: '基本文字起こし (Gemini 2.0 Flash)',
      status: 'completed',
      description: '音声ファイルから基本的な文字起こしを行います',
      result: 'Transcription completed successfully'
    })

    // Check that processing stage retains its actual status
    expect(result.topicAnalysis).toEqual({
      name: 'トピック分析 (Gemini 2.0 Flash)',
      status: 'processing',
      description: '文字起こし結果からトピックと主要テーマを分析します'
    })

    // Check that unprocessed stages remain pending
    expect(result.dictionaryCreation.status).toBe('pending')
    expect(result.finalTranscription.status).toBe('pending')
  })

  it('should preserve result and error data from actual stages', () => {
    const actualStages = {
      initialTranscription: {
        name: '基本文字起こし (Gemini 2.0 Flash)',
        status: 'completed' as const,
        result: 'Full transcription text here...'
      },
      topicAnalysis: {
        name: 'トピック分析 (Gemini 2.0 Flash)',
        status: 'error' as const,
        error: 'Failed to analyze topic'
      }
    }

    const result = mergeStagesWithDefaults(actualStages)
    
    expect((result.initialTranscription as any).result).toBe('Full transcription text here...')
    expect((result.topicAnalysis as any).error).toBe('Failed to analyze topic')
    expect(result.topicAnalysis.status).toBe('error')
  })

  it('should maintain default descriptions even when actual stage data is provided', () => {
    const actualStages = {
      initialTranscription: {
        name: '基本文字起こし (Gemini 2.0 Flash)',
        status: 'completed' as const,
        result: 'Some result'
      }
    }

    const result = mergeStagesWithDefaults(actualStages)
    
    // Description should be preserved from defaults
    expect(result.initialTranscription.description).toBe(
      '音声ファイルから基本的な文字起こしを行います'
    )
  })

  it('should handle partial stage updates correctly', () => {
    const actualStages = {
      dictionaryCreation: {
        name: '辞書作成 (Google検索+Gemini 2.0 Flash)',
        status: 'completed' as const,
        result: 'Dictionary content here'
      }
    }

    const result = mergeStagesWithDefaults(actualStages)
    
    // Only dictionaryCreation should be completed
    expect(result.initialTranscription.status).toBe('pending')
    expect(result.topicAnalysis.status).toBe('pending')
    expect(result.dictionaryCreation.status).toBe('completed')
    expect(result.finalTranscription.status).toBe('pending')
    
    // Completed stage should have result
    expect((result.dictionaryCreation as any).result).toBe('Dictionary content here')
  })
})