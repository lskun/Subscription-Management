import { supabase } from '@/lib/supabase'
import type { 
  UserProfile, 
  UpdateUserProfileData, 
  UserSettings, 
  UserPreferences 
} from '@/types/userProfile'
import { useSettingsStore } from '@/store/settingsStore'

// CacheManager 已迁移到 settingsStore

/**
 * 用户资料管理服务
 */
export class UserProfileService {
  /**
   * 获取用户资料信息（带缓存和请求去重）
   */
  static async getUserProfile(userId?: string): Promise<UserProfile | null> {
    try {
      const user = await useSettingsStore.getState().getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      // 生成缓存键
      const cacheKey = useSettingsStore.getState().generateCacheKey('user_profile', targetUserId)
      
      // 检查缓存
      const cached = useSettingsStore.getState().getFromGlobalCache<any>(cacheKey)
      
      if (cached.data) {
        console.log('🎯 使用缓存的用户资料数据:', targetUserId)
        return cached.data
      }
      
      if (cached.promise) {
        console.log('⏳ 等待现有的用户资料获取请求:', targetUserId)
        return cached.promise
      }

      console.log('🔄 发起新的用户资料请求:', targetUserId)

      // 创建新的获取 Promise
      const fetchPromise = (async () => {
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', targetUserId)
            .single()

          if (error) {
            if (error.code === 'PGRST116') {
              console.log('📝 用户资料不存在，创建默认资料:', targetUserId)
              // 用户资料不存在，创建默认资料
              const profile = await this.createDefaultProfile(targetUserId)
              // 设置缓存
              useSettingsStore.getState().setGlobalCache(cacheKey, profile)
              return profile
            }
            throw error
          }

          console.log('✅ 用户资料获取成功，设置缓存:', targetUserId)
          // 设置缓存
          useSettingsStore.getState().setGlobalCache(cacheKey, data)
          return data
        } finally {
          // 请求完成后清除 Promise 引用
          useSettingsStore.getState().clearGlobalCachePromise(cacheKey)
        }
      })();

      // 存储 Promise 用于去重
      useSettingsStore.getState().setGlobalCachePromise(cacheKey, fetchPromise)
      return fetchPromise
    } catch (error) {
      console.error('获取用户资料失败:', error)
      throw error
    }
  }

  /**
   * 创建默认用户资料
   */
  static async createDefaultProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await useSettingsStore.getState().getCurrentUser()
      const userEmail = user?.email || ''
      const displayName = userEmail.split('@')[0] || '用户'

      const defaultProfile = {
        id: userId,
        display_name: displayName,
        avatar_url: null,
        timezone: 'Asia/Shanghai',
        language: 'zh-CN',
        email: userEmail,
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
      console.error('创建默认用户资料失败:', error)
      throw error
    }
  }

  /**
   * 更新用户资料信息
   */
  static async updateUserProfile(
    updates: UpdateUserProfileData,
    userId?: string
  ): Promise<UserProfile> {
    try {
      const user = await useSettingsStore.getState().getCurrentUser();
    const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      // 验证数据
      const errors = this.validateProfileData(updates)
      if (errors.length > 0) {
        throw new Error(errors.join(', '))
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

      // 清除缓存以确保下次获取最新数据
      const cacheKey = useSettingsStore.getState().generateCacheKey('userProfile', targetUserId)
      useSettingsStore.getState().clearGlobalCache(cacheKey)
      
      return data as UserProfile
    } catch (error) {
      console.error('更新用户资料失败:', error)
      throw error
    }
  }

  /**
   * 上传用户头像
   */
  static async uploadAvatar(file: File, userId?: string): Promise<string> {
    try {
      const user = await useSettingsStore.getState().getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('User not logged in')
      }

      // 验证文件类型
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file')
      }

      // 验证文件大小（最大2MB）
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Image file size cannot exceed 2MB')
      }

      // 生成唯一文件名
      const fileExt = file.name.split('.').pop()
      const fileName = `${targetUserId}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // 上传文件到 Supabase 存储
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

      // 更新用户资料中的头像URL
      // updateUserProfile 方法会在内部清除缓存
      await this.updateUserProfile({ avatar_url: publicUrl }, targetUserId)

      return publicUrl
    } catch (error) {
      console.error('Upload avatar failed:', error)
      throw error
    }
  }

  /**
   * 获取 Google 头像URL（不再上传到 Supabase 存储，直接返回原始URL）
   * @param googleAvatarUrl Google avatar URL
   * @param userId User ID (optional)
   * @returns Google avatar URL
   */
  static async getGoogleAvatarUrl(googleAvatarUrl: string, userId?: string): Promise<string> {
    try {
      let targetUserId = userId
      
      // 仅在未提供 userId 时调用 UserCacheService
      if (!targetUserId) {
        const user = await useSettingsStore.getState().getCurrentUser()
        if (!user) {
          throw new Error('User not logged in')
        }
        targetUserId = user.id
      }

      // 检查用户资料是否有自定义头像（非Google头像）
      const profile = await this.getUserProfile(targetUserId)
      if (profile?.avatar_url && !profile.avatar_url.includes('googleusercontent.com')) {
        // 已有自定义头像，直接返回
        return profile.avatar_url
      }

      // 直接返回 Google 头像URL，不再上传到 Supabase 存储
      return googleAvatarUrl
    } catch (error) {
      console.warn('Get Google avatar failed:', error)
      // 如果获取失败，返回原始 Google URL
      return googleAvatarUrl
    }
  }

  /**
   * 获取用户头像URL（优先使用缓存头像）
   * @param userId User ID
   * @returns Avatar URL
   */
  static async getUserAvatarUrl(userId?: string): Promise<string | null> {
    try {
      // Use settingsStore to get user information
      // 使用 settingsStore 获取用户信息
      const user = await useSettingsStore.getState().getCurrentUser()
      if (!user) {
        return null
      }

      const targetUserId = userId || user.id

      // Generate avatar cache key
      // 生成头像缓存键
      const avatarCacheKey = useSettingsStore.getState().generateCacheKey('userAvatar', targetUserId)
      
      // Check avatar cache
      // 检查头像缓存
      const avatarCached = useSettingsStore.getState().getFromGlobalCache<string | null>(avatarCacheKey)
      
      if (avatarCached.data !== null) {
        console.log('🎯 Using cached user avatar:', targetUserId)
        return avatarCached.data
      }
      
      if (avatarCached.promise) {
        console.log('⏳ Waiting for existing user avatar fetch request:', targetUserId)
        return avatarCached.promise
      }

      console.log('🔄 Initiating new user avatar request:', targetUserId)

      // 创建新的获取Promise
      const fetchAvatarPromise = (async () => {
        try {
          // 从用户资料获取头像
          const profile = await this.getUserProfile(targetUserId)
          
          // 如果资料有头像且不是Google头像，直接返回
          if (profile?.avatar_url && !profile.avatar_url.includes('googleusercontent.com')) {
            const avatarUrl = profile.avatar_url
            useSettingsStore.getState().setGlobalCache(avatarCacheKey, avatarUrl)
            return avatarUrl
          }

          // 如果用户元数据有Google头像，处理Google头像
          const googleAvatarUrl = user.user_metadata?.avatar_url
          if (googleAvatarUrl && googleAvatarUrl.includes('googleusercontent.com')) {
            const processedUrl = await this.getGoogleAvatarUrl(googleAvatarUrl, targetUserId)
            useSettingsStore.getState().setGlobalCache(avatarCacheKey, processedUrl)
            return processedUrl
          }

          // 返回资料中的头像或null
          const avatarUrl = profile?.avatar_url || null
          useSettingsStore.getState().setGlobalCache(avatarCacheKey, avatarUrl)
          return avatarUrl
        } finally {
          // 请求完成后清除Promise引用
          useSettingsStore.getState().clearGlobalCachePromise(avatarCacheKey)
        }
      })();

      // 存储Promise用于去重
      useSettingsStore.getState().setGlobalCachePromise(avatarCacheKey, fetchAvatarPromise)
      return fetchAvatarPromise
    } catch (error) {
      console.warn('Get user avatar failed:', error)
      return null
    }
  }

  /**
   * 删除用户头像
   */
  static async deleteAvatar(userId?: string): Promise<void> {
    try {
      const user = await useSettingsStore.getState().getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('User not logged in')
      }

      // 获取当前头像URL
      const profile = await this.getUserProfile(targetUserId)
      if (!profile?.avatar_url) {
        return
      }

      // 从URL提取文件路径
      const url = new URL(profile.avatar_url)
      const filePath = url.pathname.split('/').slice(-2).join('/')

      // 从存储中删除文件
      const { error: deleteError } = await supabase.storage
        .from('user-avatars')
        .remove([filePath])

      if (deleteError) {
        console.warn('Delete avatar file failed:', deleteError)
        // 即使文件删除失败也清除数据库中的URL
      }

      // 清除用户资料中的头像URL
      // updateUserProfile 方法会在内部清除缓存
      await this.updateUserProfile({ avatar_url: null }, targetUserId)
    } catch (error) {
      console.error('Failed to delete avatar:', error)
      throw error
    }
  }

  /**
   * Get user setting (with cache)
   * 获取用户设置（带缓存）
   */
  static async getUserSetting(
    settingKey: string,
    userId?: string
  ): Promise<any> {
    try {
      const user = await useSettingsStore.getState().getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('User not logged in')
      }

      // 生成缓存键
      const cacheKey = useSettingsStore.getState().generateCacheKey('userSetting', `${targetUserId}_${settingKey}`)
      
      // 检查缓存
      const cached = useSettingsStore.getState().getFromGlobalCache<any>(cacheKey)
      
      if (cached.data !== null) {
        console.log('🎯 Using cached user setting data:', settingKey, targetUserId)
        return cached.data
      }
      
      if (cached.promise) {
        console.log('⏳ Waiting for existing user setting fetch request:', settingKey, targetUserId)
        return cached.promise
      }

      console.log('🔄 Initiating new user setting request:', settingKey, targetUserId)

      // 创建新的获取Promise
      const fetchPromise = (async () => {
        try {
          const { data, error } = await supabase
            .from('user_settings')
            .select('setting_value')
            .eq('user_id', targetUserId)
            .eq('setting_key', settingKey)
            .single()

          if (error) {
            if (error.code === 'PGRST116') {
              // 设置不存在，返回null并缓存
              console.log('📝 User setting doesn\'t exist, caching null value:', settingKey, targetUserId)
              useSettingsStore.getState().setGlobalCache(cacheKey, null)
              return null
            }
            throw error
          }

          console.log('✅ User setting fetch successful, setting cache:', settingKey, targetUserId)
          // 设置缓存
          useSettingsStore.getState().setGlobalCache(cacheKey, data.setting_value)
          return data.setting_value
        } finally {
          // 请求完成后清除Promise引用
          useSettingsStore.getState().clearGlobalCachePromise(cacheKey)
        }
      })();

      // 存储Promise用于去重
      useSettingsStore.getState().setGlobalCachePromise(cacheKey, fetchPromise)
      return fetchPromise
    } catch (error) {
      console.error('Get user setting failed:', error)
      throw error
    }
  }

  /**
   * 设置用户设置（自动清除缓存）
   */
  static async setUserSetting(
    settingKey: string,
    settingValue: any,
    userId?: string
  ): Promise<void> {
    try {
      const user = await useSettingsStore.getState().getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('User not logged in')
      }
      
      const { data, error } = await supabase
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
      console.error('Failed to set user setting:', error)
      throw error
    }
  }

  /**
   * Get user preferences (with cache and request deduplication)
   */
  static async getUserPreferences(userId?: string): Promise<UserPreferences> {
    try {
      const user = await useSettingsStore.getState().getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('User not logged in')
      }

      // Generate cache key
      const cacheKey = useSettingsStore.getState().generateCacheKey('userPreferences', targetUserId)
      
      // Check cache
      const cached = useSettingsStore.getState().getFromGlobalCache<UserPreferences>(cacheKey)
      
      if (cached.data) {
        return cached.data
      }
      
      if (cached.promise) {
        console.log('Waiting for existing user preferences fetch request')
        return cached.promise
      }

      // Create new fetch Promise
      const fetchPromise = (async () => {
        try {
          const preferences = await this.getUserSetting('preferences', userId)
          
          // Return default preferences if user hasn't set any
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

          const result = preferences ? { ...defaultPreferences, ...preferences } : defaultPreferences
          
          // Set cache
          useSettingsStore.getState().setGlobalCache(cacheKey, result)
          return result
        } finally {
          // Clear Promise reference after request completion
          useSettingsStore.getState().clearGlobalCachePromise(cacheKey)
        }
      })();

      // Store Promise for deduplication
      useSettingsStore.getState().setGlobalCachePromise(cacheKey, fetchPromise)
      return fetchPromise
    } catch (error) {
      console.error('获取用户偏好设置失败:', error)
      throw error
    }
  }

  /**
   * Update user preferences
   */
  static async updateUserPreferences(
    preferences: Partial<UserPreferences>,
    userId?: string
  ): Promise<UserPreferences> {
    try {
      const user = await useSettingsStore.getState().getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('User not logged in')
      }

      // 获取当前偏好设置
      const currentPreferences = await this.getUserPreferences(userId)
      
      // 合并更新，确保嵌套对象正确合并
      const updatedPreferences = {
        ...currentPreferences,
        ...preferences,
        // 确保嵌套对象正确合并
        notifications: preferences.notifications ? {
          ...currentPreferences.notifications,
          ...preferences.notifications
        } : currentPreferences.notifications,
        privacy: preferences.privacy ? {
          ...currentPreferences.privacy,
          ...preferences.privacy
        } : currentPreferences.privacy
      }

      // Save updated preferences
      // 保存更新的偏好设置
      await this.setUserSetting('preferences', updatedPreferences, userId)

      // 清除缓存以确保下次获取最新数据
      const cacheKey = useSettingsStore.getState().generateCacheKey('userPreferences', targetUserId)
      useSettingsStore.getState().clearGlobalCache(cacheKey)

      return updatedPreferences
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
      const user = await useSettingsStore.getState().getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('User not logged in')
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
      const user = await useSettingsStore.getState().getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('User not logged in')
      }

      const { error } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', targetUserId)
        .eq('setting_key', settingKey)

      if (error) {
        throw error
      }

      // 如果删除的是偏好设置，清除相关缓存
      if (settingKey === 'preferences') {
        const cacheKey = useSettingsStore.getState().generateCacheKey('userPreferences', targetUserId)
        useSettingsStore.getState().clearGlobalCache(cacheKey)
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
      const user = await useSettingsStore.getState().getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('User not logged in')
      }

      const { error } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', targetUserId)

      if (error) {
        throw error
      }

      // 清除该用户的所有缓存
      useSettingsStore.getState().clearGlobalCacheById(targetUserId)
    } catch (error) {
      console.error('重置用户设置失败:', error)
      throw error
    }
  }

  /**
   * 清除用户相关的所有缓存
   * 在需要清除所有用户相关缓存时调用
   */
  static clearUserCache(userId?: string): void {
    if (userId) {
      // 清除特定用户的所有缓存
      useSettingsStore.getState().clearGlobalCacheById(userId)
    } else {
      // 清除所有用户的缓存
      useSettingsStore.getState().clearGlobalCacheByType('userProfile')
      useSettingsStore.getState().clearGlobalCacheByType('userPreferences')
    }
  }

  /**
   * 验证用户资料数据
   */
  static validateProfileData(data: UpdateUserProfileData): string[] {
    const errors: string[] = []

    if (data.display_name !== undefined) {
      if (typeof data.display_name !== 'string') {
        errors.push('Display name must be a string')
      } else if (data.display_name.length > 50) {
        errors.push('Display name cannot exceed 50 characters')
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
        errors.push('Invalid timezone setting')
      }
    }

    if (data.language !== undefined) {
      const validLanguages = [
        'zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 
        'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 
        'pt-BR', 'ru-RU'
      ]
      if (!validLanguages.includes(data.language)) {
        errors.push('Invalid language setting')
      }
    }

    return errors
  }
}