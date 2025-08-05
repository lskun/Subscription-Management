import { supabase } from '@/lib/supabase'
import { CurrencyType } from '@/config/currency'

export type ThemeType = 'light' | 'dark' | 'system'

export interface UserSettings {
  currency: CurrencyType
  theme: ThemeType
  show_original_currency: boolean
  timezone?: string
  language?: string
  [key: string]: any // 允许其他自定义设置
}

export interface UserSettingRecord {
  id: string
  user_id: string
  setting_key: string
  setting_value: any
  created_at: string
  updated_at: string
}

/**
 * Supabase用户设置管理服务
 * 提供基于Supabase的用户个性化设置管理
 */
export class SupabaseUserSettingsService {
  /**
   * 获取用户的所有设置
   */
  async getUserSettings(): Promise<UserSettings> {
    // 获取当前用户ID
    const { useSettingsStore } = await import('@/store/settingsStore');
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      // 如果用户未登录，返回默认设置而不是抛出错误
      console.warn('User not logged in, returning default settings')
      return {
        currency: 'CNY',
        theme: 'system',
        show_original_currency: true,
        timezone: 'Asia/Shanghai',
        language: 'zh-CN',
      }
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('setting_key, setting_value')
      .eq('user_id', user.id)

    if (error) {
      console.error('Error fetching user settings:', error)
      throw new Error(`获取用户设置失败: ${error.message}`)
    }

    // 将设置数组转换为对象
    const settings: Partial<UserSettings> = {}
    data?.forEach(setting => {
      let value = setting.setting_value
      
      // 如果setting_value是对象且包含value属性，提取实际值
      if (typeof value === 'object' && value !== null && 'value' in value) {
        value = (value as any).value
      }
      
      settings[setting.setting_key as keyof UserSettings] = value
    })

    // 返回设置，如果没有设置则使用默认值
    return {
      currency: settings.currency || 'CNY',
      theme: settings.theme || 'system',
      show_original_currency: settings.show_original_currency !== undefined ? settings.show_original_currency : true,
      timezone: settings.timezone || 'Asia/Shanghai',
      language: settings.language || 'zh-CN',
      ...settings
    }
  }

  /**
   * 获取单个设置值
   */
  async getSetting<T = any>(key: string): Promise<T | null> {
    // 获取当前用户ID
    const { useSettingsStore } = await import('@/store/settingsStore');
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('用户未登录')
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('setting_value')
      .eq('user_id', user.id)
      .eq('setting_key', key)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // 设置不存在
      }
      console.error('Error fetching user setting:', error)
      throw new Error(`获取用户设置失败: ${error.message}`)
    }

    let value = data.setting_value
    
    // 如果setting_value是对象且包含value属性，提取实际值
    if (typeof value === 'object' && value !== null && 'value' in value) {
      value = (value as any).value
    }

    return value
  }

  /**
   * 设置单个设置值
   */
  async setSetting(key: string, value: any): Promise<void> {
    // 获取当前用户ID
    const { useSettingsStore } = await import('@/store/settingsStore');
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('用户未登录')
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        setting_key: key,
        setting_value: value
      }, {
        onConflict: 'user_id,setting_key'
      })

    if (error) {
      console.error('Error setting user setting:', error)
      throw new Error(`设置用户设置失败: ${error.message}`)
    }
  }

  /**
   * 批量设置多个设置值
   */
  async setSettings(settings: Partial<UserSettings>): Promise<void> {
    // 获取当前用户ID
    const { useSettingsStore } = await import('@/store/settingsStore');
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('用户未登录')
    }

    // 将设置对象转换为数组
    const settingsArray = Object.entries(settings).map(([key, value]) => ({
      user_id: user.id,
      setting_key: key,
      setting_value: value
    }))

    const { error } = await supabase
      .from('user_settings')
      .upsert(settingsArray, {
        onConflict: 'user_id,setting_key'
      })

    if (error) {
      console.error('Error setting user settings:', error)
      throw new Error(`批量设置用户设置失败: ${error.message}`)
    }
  }

  /**
   * 删除单个设置
   */
  async deleteSetting(key: string): Promise<void> {
    // 获取当前用户ID
    const { useSettingsStore } = await import('@/store/settingsStore');
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('用户未登录')
    }

    const { error } = await supabase
      .from('user_settings')
      .delete()
      .eq('user_id', user.id)
      .eq('setting_key', key)

    if (error) {
      console.error('Error deleting user setting:', error)
      throw new Error(`删除用户设置失败: ${error.message}`)
    }
  }

  /**
   * 重置所有用户设置
   */
  async resetAllSettings(): Promise<void> {
    // 获取当前用户ID
    const { useSettingsStore } = await import('@/store/settingsStore');
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('用户未登录')
    }

    const { error } = await supabase
      .from('user_settings')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Error resetting user settings:', error)
      throw new Error(`重置用户设置失败: ${error.message}`)
    }
  }

  /**
   * 获取用户主题设置
   */
  async getTheme(): Promise<ThemeType> {
    const theme = await this.getSetting<ThemeType>('theme')
    return theme || 'system'
  }

  /**
   * 设置用户主题
   */
  async setTheme(theme: ThemeType): Promise<void> {
    await this.setSetting('theme', theme)
  }

  /**
   * 获取用户货币设置
   */
  async getCurrency(): Promise<CurrencyType> {
    const currency = await this.getSetting<CurrencyType>('currency')
    return currency || 'CNY'
  }

  /**
   * 设置用户货币
   */
  async setCurrency(currency: CurrencyType): Promise<void> {
    await this.setSetting('currency', currency)
  }

  /**
   * 获取是否显示原始货币设置
   */
  async getShowOriginalCurrency(): Promise<boolean> {
    const show = await this.getSetting<boolean>('show_original_currency')
    return show !== null ? show : true
  }

  /**
   * 设置是否显示原始货币
   */
  async setShowOriginalCurrency(show: boolean): Promise<void> {
    await this.setSetting('show_original_currency', show)
  }
}

// 导出单例实例
export const supabaseUserSettingsService = new SupabaseUserSettingsService()