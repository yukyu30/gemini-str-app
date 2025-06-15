import { useEffect, useCallback } from 'react'

interface UseProcessingLockProps {
  isProcessing: boolean
  processingCount: number
  onNavigationAttempt?: () => void
}

export const useProcessingLock = ({ 
  isProcessing, 
  processingCount, 
  onNavigationAttempt 
}: UseProcessingLockProps) => {
  
  // ページ離脱の警告
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (isProcessing && processingCount > 0) {
      e.preventDefault()
      e.returnValue = '音声変換処理が実行中です。ページを離れると処理が中断されます。'
      return e.returnValue
    }
  }, [isProcessing, processingCount])

  // ブラウザの戻る/進むボタンの処理
  const handlePopState = useCallback((e: PopStateEvent) => {
    if (isProcessing && processingCount > 0) {
      e.preventDefault()
      // 現在の履歴を維持
      window.history.pushState(null, '', window.location.href)
      
      if (onNavigationAttempt) {
        onNavigationAttempt()
      } else {
        // デフォルトの警告
        const proceed = window.confirm(
          `${processingCount}件の音声変換が実行中です。\n` +
          'ページを移動すると処理が中断されます。\n' +
          '続行しますか？'
        )
        
        if (proceed) {
          // ユーザーが続行を選択した場合、履歴を戻す
          window.history.back()
        }
      }
    }
  }, [isProcessing, processingCount, onNavigationAttempt])

  useEffect(() => {
    if (isProcessing && processingCount > 0) {
      // ページ離脱警告を設定
      window.addEventListener('beforeunload', handleBeforeUnload)
      
      // ブラウザの戻る/進むボタンを無効化
      window.history.pushState(null, '', window.location.href)
      window.addEventListener('popstate', handlePopState)
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
        window.removeEventListener('popstate', handlePopState)
      }
    }
  }, [isProcessing, processingCount, handleBeforeUnload, handlePopState])

  return {
    isLocked: isProcessing && processingCount > 0,
    processingCount
  }
}