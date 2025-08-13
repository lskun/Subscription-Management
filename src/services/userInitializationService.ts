import { supabase } from '@/lib/supabase'
import { supabaseGateway } from '@/utils/supabase-gateway'
import type { User } from '@supabase/supabase-js'

/**
 * 用户初始化服务
 * 处理新用户注册后的自动初始化流程
 */
export class UserInitializationService {
  /**
   * 初始化新用户数据
   */
  static async initializeNewUser(user: User): Promise<{
    success: boolean
    message: string
    error?: string
  }> {
    try {
      console.log('开始初始化新用户:', user.id)

      // 调用数据库函数初始化用户数据
      const { data: initResult, error: initError } = await supabaseGateway.rpc('initialize_current_user_data')

      if (initError) {
        console.error('用户数据初始化失败:', initError)
        return {
          success: false,
          message: '用户数据初始化失败',
          error: initError.message
        }
      }

      console.log('用户数据初始化成功:', initResult)

      // 发送欢迎邮件
      try {
        await this.sendWelcomeEmail(user)
      } catch (emailError) {
        console.warn('发送欢迎邮件失败:', emailError)
        // 邮件发送失败不影响初始化结果
      }

      return {
        success: true,
        message: '用户初始化完成'
      }
    } catch (error) {
      console.error('用户初始化过程中发生错误:', error)
      return {
        success: false,
        message: '用户初始化失败',
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 发送欢迎邮件
   */
  static async sendWelcomeEmail(user: User): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('send-welcome-email', {
        body: {
          userId: user.id,
          email: user.email,
          displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || '用户'
        }
      })

      if (error) {
        throw error
      }

      console.log('欢迎邮件发送成功')
    } catch (error) {
      console.error('发送欢迎邮件失败:', error)
      throw error
    }
  }

  /**
   * 检查用户是否已经初始化
   */
  /**
   * 检查用户是否已初始化
   * 通过缓存优化减少数据库查询
   */
  static async isUserInitialized(userId: string): Promise<boolean> {
    try {
      // 首先尝试从 settingsStore 的全局缓存中获取用户配置
      const { useSettingsStore } = await import('@/store/settingsStore')
      const store = useSettingsStore.getState()
      const profileCacheKey = store.generateCacheKey('user_profile', userId)
      
      const cachedProfileResult = store.getFromGlobalCache<any>(profileCacheKey)
      
      let hasProfile = false
      
      // 检查用户配置缓存
      if (cachedProfileResult.data) {
        // 使用缓存中的数据
        hasProfile = true
        console.log('使用缓存检查用户配置存在性')
      } else {
        // 缓存不存在，直接查询数据库
        console.log('🔍 [DEBUG] isUserInitialized: 用户配置缓存未命中，查询 user_profiles 表', { userId, cacheKey: profileCacheKey })
        console.log('🚨 [NETWORK] 即将发起 user_profiles 数据库查询请求', { userId, timestamp: new Date().toISOString() })
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', userId)
          .single()
        
        console.log('🚨 [NETWORK] user_profiles 数据库查询完成', { userId, hasData: !!profile, error: profileError?.message })
        
        if (profileError && profileError.code !== 'PGRST116') {
          throw profileError
        }
        
        hasProfile = !!profile
        
        // 将结果缓存起来
        if (profile) {
          store.setGlobalCache(profileCacheKey, profile)
        }
      }

      return !!hasProfile
    } catch (error) {
      console.error('检查用户初始化状态失败:', error)
      return false
    }
  }

  /**
   * 重新初始化用户（用于修复数据）
   */
  static async reinitializeUser(userId: string): Promise<{
    success: boolean
    message: string
    error?: string
  }> {
    try {
      console.log('重新初始化用户:', userId)

      // 获取用户信息
      const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)
      
      if (userError || !user) {
        throw new Error('用户不存在')
      }

      // 删除现有数据（可选，根据需要决定是否清理）
      // await this.cleanupUserData(userId)

      // 重新初始化
      return await this.initializeNewUser(user)
    } catch (error) {
      console.error('重新初始化用户失败:', error)
      return {
        success: false,
        message: '重新初始化失败',
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }
}