// 邮件通知服务
import { supabase } from '../lib/supabase'

// 邮件类型定义
export type EmailType = 
  | 'welcome'
  | 'subscription_expiry'
  | 'payment_failed'
  | 'payment_success'
  | 'quota_warning'
  | 'security_alert'
  | 'system_update'
  | 'password_reset'

// 邮件请求接口
export interface EmailRequest {
  userId: string
  email: string
  type: EmailType
  data?: Record<string, any>
  templateOverride?: {
    subject?: string
    html?: string
    text?: string
  }
}

// 邮件发送结果接口
export interface EmailResult {
  success: boolean
  message: string
  emailId?: string
  error?: string
  timestamp: string
}

// 邮件日志接口
export interface EmailLog {
  id: string
  user_id: string
  email_address: string
  email_type: EmailType
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'bounced' | 'complained'
  error_message?: string
  external_email_id?: string
  metadata?: Record<string, any>
  sent_at: string
  updated_at: string
}

// 邮件偏好设置接口
export interface EmailPreference {
  id: string
  user_id: string
  email_type: EmailType
  enabled: boolean
  frequency: 'immediate' | 'daily' | 'weekly' | 'never'
  created_at: string
  updated_at: string
}

// 邮件统计接口
export interface EmailStatistics {
  total_emails: number
  sent_emails: number
  failed_emails: number
  delivered_emails: number
  bounced_emails: number
  last_email_sent?: string
}

class EmailNotificationService {
  /**
   * 发送邮件通知
   */
  async sendNotification(request: EmailRequest): Promise<EmailResult> {
    try {
      console.log('发送邮件通知:', request)

      const { data, error } = await supabase.functions.invoke('send-notification-email', {
        body: request
      })

      if (error) {
        console.error('邮件发送失败:', error)
        throw new Error(error.message || '邮件发送失败')
      }

      console.log('邮件发送成功:', data)
      return data as EmailResult
    } catch (error) {
      console.error('邮件通知服务错误:', error)
      throw error
    }
  }

  /**
   * 发送欢迎邮件
   */
  async sendWelcomeEmail(userId: string, email: string, displayName?: string): Promise<EmailResult> {
    return this.sendNotification({
      userId,
      email,
      type: 'welcome',
      data: { displayName }
    })
  }

  /**
   * 发送订阅到期提醒
   */
  async sendSubscriptionExpiryReminder(
    userId: string,
    email: string,
    subscriptionName: string,
    expiryDate: string,
    daysLeft: number,
    displayName?: string
  ): Promise<EmailResult> {
    return this.sendNotification({
      userId,
      email,
      type: 'subscription_expiry',
      data: {
        displayName,
        subscriptionName,
        expiryDate,
        daysLeft
      }
    })
  }

  /**
   * 发送支付失败通知
   */
  async sendPaymentFailedNotification(
    userId: string,
    email: string,
    subscriptionName: string,
    amount: number,
    currency: string,
    displayName?: string
  ): Promise<EmailResult> {
    return this.sendNotification({
      userId,
      email,
      type: 'payment_failed',
      data: {
        displayName,
        subscriptionName,
        amount,
        currency
      }
    })
  }

  /**
   * 发送支付成功确认
   */
  async sendPaymentSuccessConfirmation(
    userId: string,
    email: string,
    subscriptionName: string,
    amount: number,
    currency: string,
    displayName?: string
  ): Promise<EmailResult> {
    return this.sendNotification({
      userId,
      email,
      type: 'payment_success',
      data: {
        displayName,
        subscriptionName,
        amount,
        currency
      }
    })
  }

  /**
   * 发送配额警告
   */
  async sendQuotaWarning(
    userId: string,
    email: string,
    feature: string,
    currentUsage: number,
    limit: number,
    percentage: number,
    displayName?: string
  ): Promise<EmailResult> {
    return this.sendNotification({
      userId,
      email,
      type: 'quota_warning',
      data: {
        displayName,
        feature,
        currentUsage,
        limit,
        percentage
      }
    })
  }

  /**
   * 发送安全警告
   */
  async sendSecurityAlert(
    userId: string,
    email: string,
    alertType: string,
    details: string,
    displayName?: string
  ): Promise<EmailResult> {
    return this.sendNotification({
      userId,
      email,
      type: 'security_alert',
      data: {
        displayName,
        alertType,
        details
      }
    })
  }

  /**
   * 发送系统更新通知
   */
  async sendSystemUpdateNotification(
    userId: string,
    email: string,
    updateTitle: string,
    updateContent: string,
    displayName?: string
  ): Promise<EmailResult> {
    return this.sendNotification({
      userId,
      email,
      type: 'system_update',
      data: {
        displayName,
        updateTitle,
        updateContent
      }
    })
  }

  /**
   * 发送密码重置邮件
   */
  async sendPasswordResetEmail(
    userId: string,
    email: string,
    resetLink: string,
    expiryTime: string = '1小时',
    displayName?: string
  ): Promise<EmailResult> {
    return this.sendNotification({
      userId,
      email,
      type: 'password_reset',
      data: {
        displayName,
        resetLink,
        expiryTime
      }
    })
  }

  /**
   * 获取用户邮件日志
   */
  async getUserEmailLogs(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: EmailLog[]; count: number }> {
    try {
      const { data, error, count } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('sent_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('获取邮件日志失败:', error)
        throw new Error(error.message)
      }

      return { data: data || [], count: count || 0 }
    } catch (error) {
      console.error('获取邮件日志错误:', error)
      throw error
    }
  }

  /**
   * 获取用户邮件偏好设置
   */
  async getUserEmailPreferences(userId: string): Promise<EmailPreference[]> {
    try {
      const { data, error } = await supabase
        .from('user_email_preferences')
        .select('*')
        .eq('user_id', userId)
        .order('email_type')

      if (error) {
        console.error('获取邮件偏好失败:', error)
        throw new Error(error.message)
      }

      return data || []
    } catch (error) {
      console.error('获取邮件偏好错误:', error)
      throw error
    }
  }

  /**
   * 更新用户邮件偏好设置
   */
  async updateEmailPreference(
    userId: string,
    emailType: EmailType,
    enabled: boolean,
    frequency: 'immediate' | 'daily' | 'weekly' | 'never' = 'immediate'
  ): Promise<EmailPreference> {
    try {
      const { data, error } = await supabase
        .from('user_email_preferences')
        .upsert({
          user_id: userId,
          email_type: emailType,
          enabled,
          frequency,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('更新邮件偏好失败:', error)
        throw new Error(error.message)
      }

      return data
    } catch (error) {
      console.error('更新邮件偏好错误:', error)
      throw error
    }
  }

  /**
   * 批量更新邮件偏好设置
   */
  async updateEmailPreferences(
    userId: string,
    preferences: Array<{
      emailType: EmailType
      enabled: boolean
      frequency?: 'immediate' | 'daily' | 'weekly' | 'never'
    }>
  ): Promise<EmailPreference[]> {
    try {
      const updates = preferences.map(pref => ({
        user_id: userId,
        email_type: pref.emailType,
        enabled: pref.enabled,
        frequency: pref.frequency || 'immediate',
        updated_at: new Date().toISOString()
      }))

      const { data, error } = await supabase
        .from('user_email_preferences')
        .upsert(updates)
        .select()

      if (error) {
        console.error('批量更新邮件偏好失败:', error)
        throw new Error(error.message)
      }

      return data || []
    } catch (error) {
      console.error('批量更新邮件偏好错误:', error)
      throw error
    }
  }

  /**
   * 获取用户邮件统计
   */
  async getUserEmailStatistics(userId: string): Promise<EmailStatistics> {
    try {
      const { data, error } = await supabase
        .from('user_email_statistics')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('获取邮件统计失败:', error)
        // 如果没有数据，返回默认统计
        return {
          total_emails: 0,
          sent_emails: 0,
          failed_emails: 0,
          delivered_emails: 0,
          bounced_emails: 0
        }
      }

      return data
    } catch (error) {
      console.error('获取邮件统计错误:', error)
      throw error
    }
  }

  /**
   * 检查用户是否启用了特定类型的邮件通知
   */
  async isEmailTypeEnabled(userId: string, emailType: EmailType): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_email_preferences')
        .select('enabled')
        .eq('user_id', userId)
        .eq('email_type', emailType)
        .single()

      if (error) {
        console.warn('检查邮件偏好失败，默认启用:', error)
        return true // 默认启用
      }

      return data?.enabled ?? true
    } catch (error) {
      console.warn('检查邮件偏好错误，默认启用:', error)
      return true // 默认启用
    }
  }

  /**
   * 条件发送邮件（检查用户偏好）
   */
  async sendNotificationIfEnabled(request: EmailRequest): Promise<EmailResult | null> {
    try {
      // 检查用户是否启用了该类型的邮件通知
      const isEnabled = await this.isEmailTypeEnabled(request.userId, request.type)
      
      if (!isEnabled) {
        console.log(`用户 ${request.userId} 已禁用 ${request.type} 类型的邮件通知`)
        return {
          success: true,
          message: '用户已禁用此类型邮件通知',
          timestamp: new Date().toISOString()
        }
      }

      return await this.sendNotification(request)
    } catch (error) {
      console.error('条件发送邮件错误:', error)
      throw error
    }
  }
}

// 导出单例实例
export const emailNotificationService = new EmailNotificationService()
export default emailNotificationService