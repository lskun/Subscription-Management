import { supabase } from '@/lib/supabase'
import type { 
  UserProfile, 
  UpdateUserProfileData, 
  UserSettings, 
  UserPreferences 
} from '@/types/userProfile'
import { GlobalCacheService } from './globalCacheService'
import { UserCacheService } from './userCacheService'

// CacheManager 已迁移到 GlobalCacheService

/**
 * 用户配置管理服务
 */
export class UserProfileService {
  /**
   * 获取用户配置信息（带缓存和请求去重）
   */
  static async getUserProfile(userId?: string): Promise<UserProfile | null> {
    try {
      const { UserCacheService } = await import('./userCacheService');
    const user = await UserCacheService.getCurrentUser();
    const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      // 生成缓存键
      const cacheKey = GlobalCacheService.generateCacheKey('userProfile', targetUserId)
      
      // 检查缓存
      const cached = GlobalCacheService.get<UserProfile>(cacheKey)
      
      if (cached.data) {
        return cached.data
      }
      
      if (cached.promise) {
        console.log('等待现有的用户配置获取请求')
        return cached.promise
      }

      // 创建新的获取Promise
      const fetchPromise = (async () => {
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', targetUserId)
            .single()

          if (error) {
            if (error.code === 'PGRST116') {
              // 用户配置不存在，创建默认配置
              const profile = await this.createDefaultProfile(targetUserId)
              // 设置缓存
              GlobalCacheService.set(cacheKey, profile)
              return profile
            }
            throw error
          }

          // 设置缓存
          GlobalCacheService.set(cacheKey, data)
          return data
        } finally {
          // 请求完成后清除Promise引用
          GlobalCacheService.clearPromise(cacheKey)
        }
      })();

      // 存储Promise以便去重
      GlobalCacheService.setPromise(cacheKey, fetchPromise)
      return fetchPromise
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
      const { UserCacheService } = await import('./userCacheService');
    const user = await UserCacheService.getCurrentUser()
      const userEmail = user?.email || ''
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
      const { UserCacheService } = await import('./userCacheService');
    const user = await UserCacheService.getCurrentUser();
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

      // 清除缓存，确保下次获取时能获取最新数据
      const cacheKey = GlobalCacheService.generateCacheKey('userProfile', targetUserId)
      GlobalCacheService.clear(cacheKey)
      
      return data as UserProfile
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
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      const targetUserId = userId || user?.id
      
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
      // updateUserProfile 方法内部会清除缓存
      await this.updateUserProfile({ avatar_url: publicUrl }, targetUserId)

      return publicUrl
    } catch (error) {
      console.error('上传头像失败:', error)
      throw error
    }
  }

  /**
   * 缓存 Google 头像到 Supabase Storage
   * @param googleAvatarUrl Google 头像 URL
   * @param userId 用户 ID
   * @returns 缓存后的头像 URL
   */
  /**
   * 获取 Google 头像 URL（不再上传到 Supabase Storage，直接返回原始 URL）
   * @param googleAvatarUrl Google 头像 URL
   * @param userId 用户 ID（可选）
   * @returns Google 头像 URL
   */
  static async getGoogleAvatarUrl(googleAvatarUrl: string, userId?: string): Promise<string> {
    try {
      let targetUserId = userId
      
      // 只有在没有提供 userId 时才调用 UserCacheService
      if (!targetUserId) {
        const user = await UserCacheService.getCurrentUser()
        if (!user) {
          throw new Error('用户未登录')
        }
        targetUserId = user.id
      }

      // 检查用户配置中是否有自定义头像（非 Google 头像）
      const profile = await this.getUserProfile(targetUserId)
      if (profile?.avatar_url && !profile.avatar_url.includes('googleusercontent.com')) {
        // 已经有自定义头像，直接返回
        return profile.avatar_url
      }

      // 直接返回 Google 头像 URL，不再上传到 Supabase Storage
      return googleAvatarUrl
    } catch (error) {
      console.warn('获取 Google 头像失败:', error)
      // 如果获取失败，返回原始 Google URL
      return googleAvatarUrl
    }
  }

  /**
   * 获取用户头像 URL（优先使用缓存的头像）
   * @param userId 用户 ID
   * @returns 头像 URL
   */
  static async getUserAvatarUrl(userId?: string): Promise<string | null> {
    try {
      // 使用 UserCacheService 获取用户信息
      const user = await UserCacheService.getCurrentUser()
      if (!user) {
        return null
      }

      const targetUserId = userId || user.id

      // 获取用户配置中的头像
      const profile = await this.getUserProfile(targetUserId)
      
      // 如果配置中有头像且不是 Google 头像，直接返回
      if (profile?.avatar_url && !profile.avatar_url.includes('googleusercontent.com')) {
        return profile.avatar_url
      }

      // 如果用户元数据中有 Google 头像，直接返回
      const googleAvatarUrl = user.user_metadata?.avatar_url
      if (googleAvatarUrl && googleAvatarUrl.includes('googleusercontent.com')) {
        return await this.getGoogleAvatarUrl(googleAvatarUrl, targetUserId)
      }

      // 返回配置中的头像或 null
      return profile?.avatar_url || null
    } catch (error) {
      console.warn('获取用户头像失败:', error)
      return null
    }
  }

  /**
   * 删除用户头像
   */
  static async deleteAvatar(userId?: string): Promise<void> {
    try {
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      const targetUserId = userId || user?.id
      
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
      // updateUserProfile 方法内部会清除缓存
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
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      const targetUserId = userId || user?.id
      
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
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
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
      console.error('设置用户设置失败:', error)
      throw error
    }
  }

  /**
   * 获取用户偏好设置（带缓存和请求去重）
   */
  static async getUserPreferences(userId?: string): Promise<UserPreferences> {
    try {
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      // 生成缓存键
      const cacheKey = GlobalCacheService.generateCacheKey('userPreferences', targetUserId)
      
      // 检查缓存
      const cached = GlobalCacheService.get<UserPreferences>(cacheKey)
      
      if (cached.data) {
        return cached.data
      }
      
      if (cached.promise) {
        console.log('等待现有的用户偏好设置获取请求')
        return cached.promise
      }

      // 创建新的获取Promise
      const fetchPromise = (async () => {
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

          const result = preferences ? { ...defaultPreferences, ...preferences } : defaultPreferences
          
          // 设置缓存
          GlobalCacheService.set(cacheKey, result)
          return result
        } finally {
          // 请求完成后清除Promise引用
          GlobalCacheService.clearPromise(cacheKey)
        }
      })();

      // 存储Promise以便去重
      GlobalCacheService.setPromise(cacheKey, fetchPromise)
      return fetchPromise
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
  ): Promise<UserPreferences> {
    try {
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
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

      // 保存更新后的偏好设置
      await this.setUserSetting('preferences', updatedPreferences, userId)

      // 清除缓存，确保下次获取时能获取最新数据
      const cacheKey = GlobalCacheService.generateCacheKey('userPreferences', targetUserId)
      GlobalCacheService.clear(cacheKey)

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
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      const targetUserId = userId || user?.id
      
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
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      const targetUserId = userId || user?.id
      
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

      // 如果删除的是偏好设置，清除相关缓存
      if (settingKey === 'preferences') {
        const cacheKey = GlobalCacheService.generateCacheKey('userPreferences', targetUserId)
        GlobalCacheService.clear(cacheKey)
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
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      const targetUserId = userId || user?.id
      
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

      // 清除该用户的所有缓存
      GlobalCacheService.clearById(targetUserId)
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
      GlobalCacheService.clearById(userId)
    } else {
      // 清除所有用户的缓存
      GlobalCacheService.clearByType('userProfile')
      GlobalCacheService.clearByType('userPreferences')
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