import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SrtSubtitle } from '@/types/srt'

interface AudioSubtitlePreviewProps {
  audioFile: File
  subtitles: SrtSubtitle[]
}

const AudioSubtitlePreview: React.FC<AudioSubtitlePreviewProps> = ({
  audioFile,
  subtitles
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentSubtitle, setCurrentSubtitle] = useState<SrtSubtitle | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Convert SRT time format (HH:MM:SS,mmm) to seconds
  const srtTimeToSeconds = (timeString: string): number => {
    const [time, milliseconds] = timeString.split(',')
    const [hours, minutes, seconds] = time.split(':').map(Number)
    return hours * 3600 + minutes * 60 + seconds + Number(milliseconds) / 1000
  }

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Find current subtitle based on time
  const findCurrentSubtitle = (time: number): SrtSubtitle | null => {
    return subtitles.find(subtitle => {
      const startTime = srtTimeToSeconds(subtitle.startTime)
      const endTime = srtTimeToSeconds(subtitle.endTime)
      return time >= startTime && time <= endTime
    }) || null
  }

  // Initialize audio when component mounts
  useEffect(() => {
    if (!audioFile) return

    const audio = new Audio()
    audioRef.current = audio
    
    // Create URL for audio file
    const audioUrl = URL.createObjectURL(audioFile)
    audio.src = audioUrl

    // Event handlers
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      setCurrentSubtitle(findCurrentSubtitle(audio.currentTime))
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    // Add event listeners
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    // Load audio
    audio.load()

    // Cleanup
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      URL.revokeObjectURL(audioUrl)
    }
  }, [audioFile, subtitles])

  const handlePlayPause = async () => {
    if (!audioRef.current) return

    try {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        await audioRef.current.play()
      }
    } catch (error) {
      console.error('Error playing audio:', error)
    }
  }

  const handleSeek = (value: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = value
    setCurrentTime(value)
    setCurrentSubtitle(findCurrentSubtitle(value))
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">字幕プレビュー</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audio Controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePlayPause}
              aria-label={isPlaying ? 'pause' : 'play'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <span className="text-sm text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <input
              type="range"
              role="slider"
              min="0"
              max={duration}
              value={currentTime}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Subtitle Display */}
        <div className="min-h-[80px] flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/10" data-testid="subtitle-display">
          {subtitles.length === 0 ? (
            <p className="text-muted-foreground">字幕がありません</p>
          ) : currentSubtitle ? (
            <p className="text-center text-lg font-medium px-4 py-2" data-testid="current-subtitle">
              {currentSubtitle.text}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              字幕を表示するには音声を再生してください
            </p>
          )}
        </div>

        {/* Subtitle List */}
        {subtitles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">字幕一覧</h4>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {subtitles.map((subtitle) => {
                const startSeconds = srtTimeToSeconds(subtitle.startTime)
                const endSeconds = srtTimeToSeconds(subtitle.endTime)
                const isActive = currentTime >= startSeconds && currentTime <= endSeconds

                return (
                  <div
                    key={subtitle.index}
                    className={`p-3 rounded-md border text-sm cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-muted/30 border-muted-foreground/20 hover:bg-muted/50'
                    }`}
                    onClick={() => handleSeek(startSeconds)}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">
                        {subtitle.index}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(startSeconds)} - {formatTime(endSeconds)}
                      </span>
                    </div>
                    <p>{subtitle.text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AudioSubtitlePreview