import { supabase } from '@/lib/supabase'
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
      const { data: initResult, error: initError } = await supabase.rpc('initialize_current_user_data')

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
  static async isUserInitialized(userId: string): Promise<boolean> {
    try {
      // 检查用户配置是否存在
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError
      }

      // 检查用户订阅是否存在
      const { data: subscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        throw subscriptionError
      }

      return !!(profile && subscription)
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

  /**
   * 清理用户数据（谨慎使用）
   */
  static async cleanupUserData(userId: string): Promise<void> {
    try {
      console.log('清理用户数据:', userId)

      // 删除用户设置
      await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', userId)

      // 删除用户订阅关系
      await supabase
        .from('user_subscriptions')
        .delete()
        .eq('user_id', userId)

      // 删除用户配置（最后删除，因为其他表可能有外键依赖）
      await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId)

      console.log('用户数据清理完成')
    } catch (error) {
      console.error('清理用户数据失败:', error)
      throw error
    }
  }

  /**
   * 获取用户初始化状态详情
   */
  static async getUserInitializationStatus(userId: string): Promise<{
    initialized: boolean
    hasProfile: boolean
    hasSubscription: boolean
    hasSettings: boolean
    details: any
  }> {
    try {
      // 检查用户配置
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const hasProfile = !profileError && !!profile

      // 检查用户订阅
      const { data: subscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      const hasSubscription = !subscriptionError && !!subscription

      // 检查用户设置
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)

      const hasSettings = !settingsError && settings && settings.length > 0

      return {
        initialized: hasProfile && hasSubscription,
        hasProfile,
        hasSubscription,
        hasSettings,
        details: {
          profile: hasProfile ? profile : null,
          subscription: hasSubscription ? subscription : null,
          settings: hasSettings ? settings : [],
          errors: {
            profile: profileError?.message,
            subscription: subscriptionError?.message,
            settings: settingsError?.message
          }
        }
      }
    } catch (error) {
      console.error('获取用户初始化状态失败:', error)
      return {
        initialized: false,
        hasProfile: false,
        hasSubscription: false,
        hasSettings: false,
        details: {
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  }

  /**
   * 批量初始化用户（管理员功能）
   */
  static async batchInitializeUsers(userIds: string[]): Promise<{
    success: number
    failed: number
    results: Array<{
      userId: string
      success: boolean
      message: string
      error?: string
    }>
  }> {
    const results = []
    let success = 0
    let failed = 0

    for (const userId of userIds) {
      try {
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)
        
        if (userError || !user) {
          results.push({
            userId,
            success: false,
            message: '用户不存在',
            error: userError?.message || '用户不存在'
          })
          failed++
          continue
        }

        const result = await this.initializeNewUser(user)
        results.push({
          userId,
          ...result
        })

        if (result.success) {
          success++
        } else {
          failed++
        }
      } catch (error) {
        results.push({
          userId,
          success: false,
          message: '初始化失败',
          error: error instanceof Error ? error.message : '未知错误'
        })
        failed++
      }
    }

    return {
      success,
      failed,
      results
    }
  }
}