// 统一通知服务 - 新的通知系统架构
import { supabase } from '../lib/supabase'
import { supabaseGateway } from '@/utils/supabase-gateway'

// 通知类型定义
export type NotificationType = 
  | 'welcome'
  | 'subscription_expiry'
  | 'payment_failed'
  | 'payment_success'
  | 'quota_warning'
  | 'security_alert'
  | 'system_update'
  | 'password_reset'

export type NotificationChannelType = 'email' | 'sms' | 'push' | 'in_app'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export type NotificationStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'

// 通知请求接口
export interface NotificationRequest {
  userId: string
  recipient: string // 邮箱、手机号等
  type: NotificationType
  channelType: NotificationChannelType
  priority?: NotificationPriority
  data?: Record<string, any>
  scheduledAt?: string // ISO 8601 时间戳
  templateOverride?: {
    subject?: string
    html?: string
    text?: string
  }
}

// 批量通知请求
export interface BatchNotificationRequest {
  requests: NotificationRequest[]
  priority?: NotificationPriority
}

// 通知结果接口
export interface NotificationResult {
  success: boolean
  message: string
  notificationId?: string
  queueId?: string
  error?: string
  timestamp: string
}

// 批量结果接口
export interface BatchNotificationResult {
  results: NotificationResult[]
  totalSent: number
  totalFailed: number
  totalScheduled: number
}

// 用户偏好接口
export interface UserNotificationPreferences {
  userId: string
  notificationType: NotificationType
  channelType: NotificationChannelType
  enabled: boolean
  frequency: 'immediate' | 'daily' | 'weekly' | 'never'
  quietHoursStart?: string
  quietHoursEnd?: string
}

// 通知队列项接口
export interface NotificationQueueItem {
  id: string
  userId: string
  templateKey: string
  channelType: NotificationChannelType
  recipient: string
  subject?: string
  content: Record<string, any>
  variables: Record<string, any>
  scheduledAt: string
  priority: NotificationPriority
  status: NotificationStatus
  retryCount: number
  maxRetries: number
  createdAt: string
}

// 通知日志接口
export interface NotificationLog {
  id: string
  userId: string
  notificationType: NotificationType
  channelType: NotificationChannelType
  recipient: string
  subject?: string
  contentPreview?: string
  status: 'sent' | 'failed' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
  externalId?: string
  errorMessage?: string
  sentAt: string
  deliveredAt?: string
  openedAt?: string
  clickedAt?: string
  metadata?: Record<string, any>
}

class UnifiedNotificationService {
  /**
   * 发送通知（立即发送或加入队列）
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationResult> {
    try {
      console.log('统一通知服务 - 发送通知:', request)

      // 检查用户偏好设置
      const preferencesCheck = await this.checkUserPreferences(request.userId, request.type, request.channelType)
      if (!preferencesCheck.allowed) {
        return {
          success: true,
          message: `Notification blocked by user preferences: ${preferencesCheck.reason}`,
          timestamp: new Date().toISOString()
        }
      }

      // 检查user_settings中的通知权限
      const settingsCheck = await this.checkUserSettingsPermission(request.userId, request.type)
      if (!settingsCheck) {
        return {
          success: true,
          message: 'Notification blocked by user settings',
          timestamp: new Date().toISOString()
        }
      }

      // 如果有延迟发送时间，加入队列
      if (request.scheduledAt && new Date(request.scheduledAt) > new Date()) {
        return await this.scheduleNotification(request)
      }

      // 立即发送
      return await this.sendImmediately(request)
    } catch (error) {
      console.error('统一通知服务错误:', error)
      return {
        success: false,
        message: 'Unified notification service error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * 批量发送通知
   */
  async sendBatchNotifications(batchRequest: BatchNotificationRequest): Promise<BatchNotificationResult> {
    try {
      console.log('批量发送通知:', batchRequest.requests.length, '条通知')

      const results: NotificationResult[] = []
      let totalSent = 0
      let totalFailed = 0
      let totalScheduled = 0

      // 按渠道和模板分组优化
      const grouped = this.groupRequestsByChannelAndType(batchRequest.requests)
      
      for (const [groupKey, requests] of grouped) {
        console.log(`处理分组 ${groupKey}:`, requests.length, '条通知')
        
        for (const request of requests) {
          try {
            const result = await this.sendNotification({
              ...request,
              priority: request.priority || batchRequest.priority
            })
            
            results.push(result)
            
            if (result.success) {
              if (result.queueId) {
                totalScheduled++
              } else {
                totalSent++
              }
            } else {
              totalFailed++
            }
          } catch (error) {
            console.error('批量发送单个通知失败:', error)
            results.push({
              success: false,
              message: 'Individual notification failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            })
            totalFailed++
          }
        }
      }

      return {
        results,
        totalSent,
        totalFailed,
        totalScheduled
      }
    } catch (error) {
      console.error('批量发送通知错误:', error)
      throw error
    }
  }

  /**
   * 立即发送通知
   */
  private async sendImmediately(request: NotificationRequest): Promise<NotificationResult> {
    try {
      // 根据渠道类型调用相应的发送方法
      switch (request.channelType) {
        case 'email':
          return await this.sendEmailNotification(request)
        case 'sms':
          return await this.sendSMSNotification(request)
        case 'push':
          return await this.sendPushNotification(request)
        case 'in_app':
          return await this.sendInAppNotification(request)
        default:
          throw new Error(`Unsupported notification channel: ${request.channelType}`)
      }
    } catch (error) {
      console.error('立即发送通知失败:', error)
      throw error
    }
  }

  /**
   * 发送邮件通知
   */
  private async sendEmailNotification(request: NotificationRequest): Promise<NotificationResult> {
    try {
      // 调用现有的邮件发送Edge Function
      const { data, error } = await supabaseGateway.invokeFunction('send-notification-email', {
        body: {
          userId: request.userId,
          email: request.recipient,
          type: request.type,
          data: request.data,
          templateOverride: request.templateOverride
        }
      })

      if (error) {
        throw new Error(error.message || '邮件发送失败')
      }

      return {
        success: true,
        message: 'Email notification sent successfully',
        notificationId: data?.emailId,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('发送邮件通知失败:', error)
      throw error
    }
  }

  /**
   * 发送短信通知（待实现）
   */
  private async sendSMSNotification(request: NotificationRequest): Promise<NotificationResult> {
    // TODO: 实现SMS发送逻辑
    console.log('SMS通知暂未实现:', request)
    return {
      success: false,
      message: 'SMS notifications not yet implemented',
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 发送推送通知（待实现）
   */
  private async sendPushNotification(request: NotificationRequest): Promise<NotificationResult> {
    // TODO: 实现推送通知逻辑
    console.log('推送通知暂未实现:', request)
    return {
      success: false,
      message: 'Push notifications not yet implemented',
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 发送应用内通知
   */
  private async sendInAppNotification(request: NotificationRequest): Promise<NotificationResult> {
    try {
      // 获取模板
      const template = await this.getNotificationTemplate(request.type, request.channelType)
      if (!template) {
        throw new Error(`Template not found for ${request.type}:${request.channelType}`)
      }

      // 渲染内容
      const renderedContent = this.renderTemplate(template, request.data || {})

      // 存储到user_notifications表
      const { data, error } = await supabase
        .from('user_notifications')
        .insert({
          user_id: request.userId,
          title: renderedContent.subject,
          message: renderedContent.text,
          type: request.type,
          priority: request.priority || 'normal',
          metadata: {
            channelType: request.channelType,
            originalRequest: request
          }
        })
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      return {
        success: true,
        message: 'In-app notification created successfully',
        notificationId: data.id,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('发送应用内通知失败:', error)
      throw error
    }
  }

  /**
   * 调度延迟通知
   */
  async scheduleNotification(request: NotificationRequest): Promise<NotificationResult> {
    try {
      const { data, error } = await supabase
        .from('notification_queue')
        .insert({
          user_id: request.userId,
          template_key: this.getTemplateKey(request.type, request.channelType),
          channel_type: request.channelType,
          recipient: request.recipient,
          variables: request.data || {},
          scheduled_at: request.scheduledAt,
          priority: request.priority || 'normal'
        })
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      return {
        success: true,
        message: 'Notification scheduled successfully',
        queueId: data.id,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('调度通知失败:', error)
      throw error
    }
  }

  /**
   * 检查用户偏好设置
   */
  async checkUserPreferences(
    userId: string, 
    notificationType: NotificationType, 
    channelType: NotificationChannelType
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const { data, error } = await supabase
        .from('user_notification_preferences_v2')
        .select('*')
        .eq('user_id', userId)
        .eq('notification_type', notificationType)
        .eq('channel_type', channelType)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.warn('获取用户偏好失败，默认允许:', error)
        return { allowed: true }
      }

      if (!data) {
        // 没有设置偏好，默认允许
        return { allowed: true }
      }

      if (!data.enabled) {
        return { allowed: false, reason: 'User disabled this notification type' }
      }

      if (data.frequency === 'never') {
        return { allowed: false, reason: 'User set frequency to never' }
      }

      // 检查静默时间
      if (data.quiet_hours_start && data.quiet_hours_end) {
        const now = new Date()
        const currentTime = now.toTimeString().slice(0, 8)
        
        if (currentTime >= data.quiet_hours_start && currentTime <= data.quiet_hours_end) {
          return { allowed: false, reason: 'Within user quiet hours' }
        }
      }

      return { allowed: true }
    } catch (error) {
      console.warn('检查用户偏好失败，默认允许:', error)
      return { allowed: true }
    }
  }

  /**
   * 检查user_settings中的通知权限
   */
  private async checkUserSettingsPermission(userId: string, notificationType: NotificationType): Promise<boolean> {
    try {
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', userId)
        .single()

      const notifications = userSettings?.settings?.notifications || {}
      
      // 检查全局通知开关
      if (notifications.enabled === false) return false
      
      // 检查邮件通知开关
      if (notifications.email_notifications_enabled === false) return false
      
      // 检查特定类型通知开关
      const typeKey = `${notificationType}_enabled`
      if (notifications[typeKey] === false) return false
      
      return true
    } catch (error) {
      console.warn('检查用户设置权限失败，默认允许:', error)
      return true
    }
  }

  /**
   * 获取通知模板
   */
  private async getNotificationTemplate(
    notificationType: NotificationType,
    channelType: NotificationChannelType
  ) {
    try {
      const templateKey = this.getTemplateKey(notificationType, channelType)
      
      const { data, error } = await supabase
        .from('unified_notification_templates')
        .select('*')
        .eq('template_key', templateKey)
        .eq('channel_type', channelType)
        .eq('is_active', true)
        .single()

      if (error) {
        console.warn('获取模板失败:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('获取通知模板失败:', error)
      return null
    }
  }

  /**
   * 渲染模板
   */
  private renderTemplate(template: any, variables: Record<string, any>) {
    const replaceVariables = (text: string) => {
      let result = text
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g')
        result = result.replace(regex, String(value || ''))
      }
      return result
    }

    return {
      subject: template.subject_template ? replaceVariables(template.subject_template) : '',
      html: template.html_template ? replaceVariables(template.html_template) : '',
      text: template.text_template ? replaceVariables(template.text_template) : '',
      pushTitle: template.push_title ? replaceVariables(template.push_title) : '',
      pushBody: template.push_body ? replaceVariables(template.push_body) : ''
    }
  }

  /**
   * 获取模板键
   */
  private getTemplateKey(notificationType: NotificationType, channelType: NotificationChannelType): string {
    return `${notificationType}_${channelType}`
  }

  /**
   * 按渠道和类型分组请求
   */
  private groupRequestsByChannelAndType(requests: NotificationRequest[]): Map<string, NotificationRequest[]> {
    const grouped = new Map<string, NotificationRequest[]>()
    
    for (const request of requests) {
      const key = `${request.channelType}_${request.type}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(request)
    }
    
    return grouped
  }

  /**
   * 获取用户通知偏好
   */
  async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences[]> {
    try {
      const { data, error } = await supabase
        .from('user_notification_preferences_v2')
        .select('*')
        .eq('user_id', userId)
        .order('notification_type')

      if (error) {
        throw new Error(error.message)
      }

      return (data || []).map(item => ({
        userId: item.user_id,
        notificationType: item.notification_type as NotificationType,
        channelType: item.channel_type as NotificationChannelType,
        enabled: item.enabled,
        frequency: item.frequency,
        quietHoursStart: item.quiet_hours_start,
        quietHoursEnd: item.quiet_hours_end
      }))
    } catch (error) {
      console.error('获取用户通知偏好失败:', error)
      throw error
    }
  }

  /**
   * 更新用户通知偏好
   */
  async updateUserNotificationPreferences(preferences: UserNotificationPreferences[]): Promise<void> {
    try {
      const updates = preferences.map(pref => ({
        user_id: pref.userId,
        notification_type: pref.notificationType,
        channel_type: pref.channelType,
        enabled: pref.enabled,
        frequency: pref.frequency,
        quiet_hours_start: pref.quietHoursStart || null,
        quiet_hours_end: pref.quietHoursEnd || null
      }))

      const { error } = await supabase
        .from('user_notification_preferences_v2')
        .upsert(updates)

      if (error) {
        throw new Error(error.message)
      }
    } catch (error) {
      console.error('更新用户通知偏好失败:', error)
      throw error
    }
  }

  /**
   * 获取通知队列
   */
  async getNotificationQueue(
    userId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: NotificationQueueItem[]; count: number }> {
    try {
      let query = supabase
        .from('notification_queue')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error, count } = await query

      if (error) {
        throw new Error(error.message)
      }

      return {
        data: (data || []).map(item => ({
          id: item.id,
          userId: item.user_id,
          templateKey: item.template_key,
          channelType: item.channel_type as NotificationChannelType,
          recipient: item.recipient,
          subject: item.subject,
          content: item.content || {},
          variables: item.variables || {},
          scheduledAt: item.scheduled_at,
          priority: item.priority as NotificationPriority,
          status: item.status as NotificationStatus,
          retryCount: item.retry_count,
          maxRetries: item.max_retries,
          createdAt: item.created_at
        })),
        count: count || 0
      }
    } catch (error) {
      console.error('获取通知队列失败:', error)
      throw error
    }
  }

  /**
   * 获取通知日志
   */
  async getNotificationLogs(
    userId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: NotificationLog[]; count: number }> {
    try {
      let query = supabase
        .from('notification_logs_v2')
        .select('*', { count: 'exact' })
        .order('sent_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error, count } = await query

      if (error) {
        throw new Error(error.message)
      }

      return {
        data: (data || []).map(item => ({
          id: item.id,
          userId: item.user_id,
          notificationType: item.notification_type as NotificationType,
          channelType: item.channel_type as NotificationChannelType,
          recipient: item.recipient,
          subject: item.subject,
          contentPreview: item.content_preview,
          status: item.status,
          externalId: item.external_id,
          errorMessage: item.error_message,
          sentAt: item.sent_at,
          deliveredAt: item.delivered_at,
          openedAt: item.opened_at,
          clickedAt: item.clicked_at,
          metadata: item.metadata || {}
        })),
        count: count || 0
      }
    } catch (error) {
      console.error('获取通知日志失败:', error)
      throw error
    }
  }
}

// 导出单例实例
export const unifiedNotificationService = new UnifiedNotificationService()
export default unifiedNotificationService