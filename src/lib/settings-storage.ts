import { SrtSettings, DEFAULT_SRT_SETTINGS } from '@/types/srt'

const SETTINGS_STORAGE_KEY = 'srt_default_settings'

export const settingsStorage = {
  saveDefaultSettings: (settings: SrtSettings): void => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
      console.log('Default settings saved:', settings)
    } catch (error) {
      console.error('Failed to save default settings:', error)
    }
  },

  loadDefaultSettings: (): SrtSettings => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as SrtSettings
        console.log('Default settings loaded:', parsed)
        return parsed
      }
    } catch (error) {
      console.error('Failed to load default settings:', error)
    }
    
    console.log('Using default settings:', DEFAULT_SRT_SETTINGS)
    return DEFAULT_SRT_SETTINGS
  },

  resetToDefaults: (): SrtSettings => {
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY)
      console.log('Settings reset to defaults')
    } catch (error) {
      console.error('Failed to reset settings:', error)
    }
    return DEFAULT_SRT_SETTINGS
  }
}