/**
 * 用户配置相关类型定义
 */

export interface UserProfile {
  id: string
  display_name?: string
  avatar_url?: string
  timezone: string
  language: string
  created_at: string
  updated_at: string
}

export interface UpdateUserProfileData {
  display_name?: string
  avatar_url?: string
  timezone?: string
  language?: string
}

export interface UserSettings {
  id: string
  user_id: string
  setting_key: string
  setting_value: any
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  currency: string
  notifications: {
    email: boolean
    push: boolean
    renewal_reminders: boolean
    payment_confirmations: boolean
  }
  privacy: {
    profile_visibility: 'public' | 'private'
    data_sharing: boolean
  }
}

// 支持的时区列表
export const SUPPORTED_TIMEZONES = [
  { value: 'UTC', label: 'UTC (协调世界时)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (北京时间)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (东京时间)' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (首尔时间)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (香港时间)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (新加坡时间)' },
  { value: 'Europe/London', label: 'Europe/London (伦敦时间)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (巴黎时间)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (柏林时间)' },
  { value: 'America/New_York', label: 'America/New_York (纽约时间)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (洛杉矶时间)' },
  { value: 'America/Chicago', label: 'America/Chicago (芝加哥时间)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (悉尼时间)' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne (墨尔本时间)' }
] as const

// 支持的语言列表
export const SUPPORTED_LANGUAGES = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'es-ES', label: 'Español' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'ru-RU', label: 'Русский' }
] as const

export type SupportedTimezone = typeof SUPPORTED_TIMEZONES[number]['value']
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['value']