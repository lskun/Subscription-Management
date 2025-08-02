import { supabase } from '@/lib/supabase'
import type { 
  UserProfile, 
  UpdateUserProfileData, 
  UserSettings, 
  UserPreferences 
} from '@/types/userProfile'

/**
 * 用户配置管理服务
 */
export class UserProfileService {
  /**
   * 获取用户配置信息
   */
  static async getUserProfile(userId?: string): Promise<UserProfile | null> {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', targetUserId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // 用户配置不存在，创建默认配置
          return await this.createDefaultProfile(targetUserId)
        }
        throw error
      }

      return data
    } catch (error) {
      console.error('获取用户配置失败:', error)
      throw error
    }
  }

  /**
   * 创建默认用户配置
   */
  static async createDefaultProfile(userId: string): Promise<UserProfile> {
    try {
      const { data: user } = await supabase.auth.getUser()
      const userEmail = user.user?.email || ''
      const displayName = userEmail.split('@')[0] || '用户'

      const defaultProfile = {
        id: userId,
        display_name: displayName,
        avatar_url: null,
        timezone: 'Asia/Shanghai',
        language: 'zh-CN'
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .insert(defaultProfile)
        .select()
        .single()

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('创建默认用户配置失败:', error)
      throw error
    }
  }

  /**
   * 更新用户配置信息
   */
  static async updateUserProfile(
    updates: UpdateUserProfileData,
    userId?: string
  ): Promise<UserProfile> {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', targetUserId)
        .select()
        .single()

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('更新用户配置失败:', error)
      throw error
    }
  }

  /**
   * 上传用户头像
   */
  static async uploadAvatar(file: File, userId?: string): Promise<string> {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        throw new Error('请选择图片文件')
      }

      // 验证文件大小 (最大 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('图片文件大小不能超过 2MB')
      }

      // 生成唯一文件名
      const fileExt = file.name.split('.').pop()
      const fileName = `${targetUserId}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // 上传文件到Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw uploadError
      }

      // 获取公共URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(filePath)

      // 更新用户配置中的头像URL
      await this.updateUserProfile({ avatar_url: publicUrl }, targetUserId)

      return publicUrl
    } catch (error) {
      console.error('上传头像失败:', error)
      throw error
    }
  }

  /**
   * 删除用户头像
   */
  static async deleteAvatar(userId?: string): Promise<void> {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      // 获取当前头像URL
      const profile = await this.getUserProfile(targetUserId)
      if (!profile?.avatar_url) {
        return
      }

      // 从URL中提取文件路径
      const url = new URL(profile.avatar_url)
      const filePath = url.pathname.split('/').slice(-2).join('/')

      // 删除存储中的文件
      const { error: deleteError } = await supabase.storage
        .from('user-avatars')
        .remove([filePath])

      if (deleteError) {
        console.warn('删除头像文件失败:', deleteError)
        // 即使删除文件失败，也要清除数据库中的URL
      }

      // 清除用户配置中的头像URL
      await this.updateUserProfile({ avatar_url: null }, targetUserId)
    } catch (error) {
      console.error('删除头像失败:', error)
      throw error
    }
  }

  /**
   * 获取用户设置
   */
  static async getUserSetting(
    settingKey: string,
    userId?: string
  ): Promise<any> {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('user_id', targetUserId)
        .eq('setting_key', settingKey)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // 设置不存在，返回null
          return null
        }
        throw error
      }

      return data.setting_value
    } catch (error) {
      console.error('获取用户设置失败:', error)
      throw error
    }
  }

  /**
   * 设置用户设置
   */
  static async setUserSetting(
    settingKey: string,
    settingValue: any,
    userId?: string
  ): Promise<void> {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: targetUserId,
          setting_key: settingKey,
          setting_value: settingValue
        })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('设置用户设置失败:', error)
      throw error
    }
  }

  /**
   * 获取用户偏好设置
   */
  static async getUserPreferences(userId?: string): Promise<UserPreferences> {
    try {
      const preferences = await this.getUserSetting('preferences', userId)
      
      // 返回默认偏好设置，如果用户没有设置
      const defaultPreferences: UserPreferences = {
        theme: 'system',
        currency: 'CNY',
        notifications: {
          email: true,
          push: true,
          renewal_reminders: true,
          payment_confirmations: true
        },
        privacy: {
          profile_visibility: 'private',
          data_sharing: false
        }
      }

      return preferences ? { ...defaultPreferences, ...preferences } : defaultPreferences
    } catch (error) {
      console.error('获取用户偏好设置失败:', error)
      throw error
    }
  }

  /**
   * 更新用户偏好设置
   */
  static async updateUserPreferences(
    preferences: Partial<UserPreferences>,
    userId?: string
  ): Promise<void> {
    try {
      const currentPreferences = await this.getUserPreferences(userId)
      const updatedPreferences = { ...currentPreferences, ...preferences }
      
      await this.setUserSetting('preferences', updatedPreferences, userId)
    } catch (error) {
      console.error('更新用户偏好设置失败:', error)
      throw error
    }
  }

  /**
   * 获取所有用户设置
   */
  static async getAllUserSettings(userId?: string): Promise<UserSettings[]> {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', targetUserId)
        .order('setting_key')

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('获取所有用户设置失败:', error)
      throw error
    }
  }

  /**
   * 删除用户设置
   */
  static async deleteUserSetting(
    settingKey: string,
    userId?: string
  ): Promise<void> {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      const { error } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', targetUserId)
        .eq('setting_key', settingKey)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('删除用户设置失败:', error)
      throw error
    }
  }

  /**
   * 重置所有用户设置
   */
  static async resetAllUserSettings(userId?: string): Promise<void> {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      const { error } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', targetUserId)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('重置用户设置失败:', error)
      throw error
    }
  }

  /**
   * 验证用户配置数据
   */
  static validateProfileData(data: UpdateUserProfileData): string[] {
    const errors: string[] = []

    if (data.display_name !== undefined) {
      if (typeof data.display_name !== 'string') {
        errors.push('显示名称必须是字符串')
      } else if (data.display_name.length > 50) {
        errors.push('显示名称不能超过50个字符')
      }
    }

    if (data.timezone !== undefined) {
      const validTimezones = [
        'UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 
        'Asia/Hong_Kong', 'Asia/Singapore', 'Europe/London', 
        'Europe/Paris', 'Europe/Berlin', 'America/New_York', 
        'America/Los_Angeles', 'America/Chicago', 'Australia/Sydney', 
        'Australia/Melbourne'
      ]
      if (!validTimezones.includes(data.timezone)) {
        errors.push('无效的时区设置')
      }
    }

    if (data.language !== undefined) {
      const validLanguages = [
        'zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 
        'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 
        'pt-BR', 'ru-RU'
      ]
      if (!validLanguages.includes(data.language)) {
        errors.push('无效的语言设置')
      }
    }

    return errors
  }
}