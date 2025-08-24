// 应用内通知渠道实现
import { supabase } from '@/lib/supabase'
import { 
  NotificationChannel, 
  NotificationRequest, 
  NotificationResult,
  ChannelConfig,
  DeliveryStatus 
} from './index'

export class InAppChannel implements NotificationChannel {
  public readonly channelType = 'in_app' as const

  /**
   * 发送应用内通知
   */
  async send(request: NotificationRequest): Promise<NotificationResult> {
    try {
      console.log('应用内渠道 - 发送通知:', request)

      // 渲染通知内容
      const content = await this.renderInAppContent(request)

      // 存储到user_notifications表
      const { data, error } = await supabase
        .from('user_notifications')
        .insert({
          user_id: request.userId,
          title: content.title,
          message: content.message,
          type: this.mapNotificationType(request.type),
          priority: request.priority || 'normal',
          action_url: content.actionUrl,
          action_label: content.actionLabel,
          metadata: {
            notificationType: request.type,
            channelType: request.channelType,
            originalRequest: {
              type: request.type,
              data: request.data
            }
          },
          expires_at: content.expiresAt
        })
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      // 记录到统一日志表
      await this.logNotification(request, {
        success: true,
        externalId: data.id,
        status: 'sent'
      }, content)

      return {
        success: true,
        message: 'In-app notification created successfully',
        notificationId: data.id,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('应用内渠道发送失败:', error)
      
      // 记录失败日志
      await this.logNotification(request, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed'
      })

      return {
        success: false,
        message: 'In-app notification failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * 验证配置
   */
  validate(_config: ChannelConfig): boolean {
    // 应用内通知通常不需要外部配置
    return true
  }

  /**
   * 检查渠道是否启用
   */
  async isEnabled(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('notification_channels')
        .select('is_enabled')
        .eq('channel_type', 'in_app')
        .single()

      if (error) {
        console.warn('检查应用内渠道状态失败:', error)
        return true // 默认启用
      }

      return data?.is_enabled !== false
    } catch (error) {
      console.error('检查应用内渠道启用状态失败:', error)
      return true // 默认启用
    }
  }

  /**
   * 获取投递状态
   */
  async getDeliveryStatus(externalId: string): Promise<DeliveryStatus> {
    try {
      // 查询user_notifications表获取状态
      const { data, error } = await supabase
        .from('user_notifications')
        .select('is_read, is_archived, created_at')
        .eq('id', externalId)
        .single()

      if (error || !data) {
        throw new Error('In-app notification not found')
      }

      let status: DeliveryStatus['status'] = 'sent'
      if (data.is_read) {
        status = 'opened'
      } else if (data.is_archived) {
        status = 'delivered'
      }

      return {
        status,
        timestamp: data.created_at,
        details: data.is_read ? 'User has read the notification' : 'Notification delivered to user'
      }
    } catch (error) {
      console.error('获取应用内通知投递状态失败:', error)
      throw error
    }
  }

  /**
   * 渲染应用内通知内容
   */
  private async renderInAppContent(request: NotificationRequest): Promise<{
    title: string
    message: string
    actionUrl?: string
    actionLabel?: string
    expiresAt?: string
  }> {
    try {
      // 获取应用内通知模板
      const { data: template } = await supabase
        .from('unified_notification_templates')
        .select('subject_template, text_template, variables')
        .eq('notification_type', request.type)
        .eq('channel_type', 'in_app')
        .eq('is_active', true)
        .single()

      const variables = {
        ...request.data,
        displayName: request.data?.displayName || 'User',
        userName: request.data?.userName || 'User'
      }

      // 如果有模板，使用模板渲染
      if (template) {
        const replaceVariables = (text: string) => {
          let result = text
          for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g')
            result = result.replace(regex, String(value || ''))
          }
          return result
        }

        return {
          title: template.subject_template ? replaceVariables(template.subject_template) : this.getDefaultTitle(request.type),
          message: template.text_template ? replaceVariables(template.text_template) : this.getDefaultMessage(request.type, variables),
          actionUrl: this.getActionUrl(request.type, request.data),
          actionLabel: this.getActionLabel(request.type),
          expiresAt: this.getExpirationTime(request.type)
        }
      }

      // 如果没有模板，使用默认内容
      return {
        title: this.getDefaultTitle(request.type),
        message: this.getDefaultMessage(request.type, variables),
        actionUrl: this.getActionUrl(request.type, request.data),
        actionLabel: this.getActionLabel(request.type),
        expiresAt: this.getExpirationTime(request.type)
      }
    } catch (error) {
      console.error('渲染应用内通知内容失败:', error)
      
      // 返回最基本的默认内容
      return {
        title: 'Notification',
        message: `You have a new ${request.type} notification.`
      }
    }
  }

  /**
   * 获取默认标题
   */
  private getDefaultTitle(notificationType: string): string {
    const titleMap: Record<string, string> = {
      welcome: 'Welcome! 🎉',
      subscription_expiry: 'Subscription Expiring ⏰',
      payment_failed: 'Payment Failed ❌',
      payment_success: 'Payment Successful ✅',
      quota_warning: 'Quota Warning ⚠️',
      security_alert: 'Security Alert 🔒',
      system_update: 'System Update 🚀',
      password_reset: 'Password Reset 🔑'
    }

    return titleMap[notificationType] || 'Notification'
  }

  /**
   * 获取默认消息
   */
  private getDefaultMessage(notificationType: string, variables: Record<string, unknown>): string {
    const { displayName = 'User' } = variables

    const messageMap: Record<string, string> = {
      welcome: `Welcome ${displayName}! Thank you for joining us.`,
      subscription_expiry: `Your subscription will expire soon. Please renew to continue enjoying our services.`,
      payment_failed: `We couldn't process your payment. Please update your payment information.`,
      payment_success: `Your payment has been processed successfully. Thank you!`,
      quota_warning: `You're approaching your usage limit. Consider upgrading your plan.`,
      security_alert: `We detected unusual activity on your account. Please review your security settings.`,
      system_update: `We've updated our system with new features and improvements.`,
      password_reset: `Click here to reset your password. This link will expire in 1 hour.`
    }

    return messageMap[notificationType] || `You have a new ${notificationType} notification.`
  }

  /**
   * 获取操作URL
   */
  private getActionUrl(notificationType: string, data?: Record<string, unknown>): string | undefined {
    const urlMap: Record<string, string> = {
      subscription_expiry: '/subscriptions',
      payment_failed: '/settings?tab=preferences',
      payment_success: '/subscriptions',
      quota_warning: '/settings?tab=preferences',
      security_alert: '/settings?tab=preferences',
      system_update: '/dashboard',
      password_reset: (data?.resetLink as string) || '/auth/reset-password'
    }

    return urlMap[notificationType]
  }

  /**
   * 获取操作标签
   */
  private getActionLabel(notificationType: string): string | undefined {
    const labelMap: Record<string, string> = {
      subscription_expiry: 'Renew Now',
      payment_failed: 'Update Payment',
      payment_success: 'View Subscriptions',
      quota_warning: 'Upgrade Plan',
      security_alert: 'Review Settings',
      system_update: 'View Updates',
      password_reset: 'Reset Password'
    }

    return labelMap[notificationType]
  }

  /**
   * 获取过期时间
   */
  private getExpirationTime(notificationType: string): string | undefined {
    const now = new Date()
    
    // 不同类型的通知有不同的过期时间
    const expirationHours: Record<string, number> = {
      welcome: 24 * 7, // 7天
      subscription_expiry: 24 * 30, // 30天
      payment_failed: 24 * 7, // 7天
      payment_success: 24 * 3, // 3天
      quota_warning: 24 * 14, // 14天
      security_alert: 24 * 30, // 30天
      system_update: 24 * 14, // 14天
      password_reset: 1 // 1小时
    }

    const hours = expirationHours[notificationType] || 24 // 默认24小时
    const expirationTime = new Date(now.getTime() + hours * 60 * 60 * 1000)
    
    return expirationTime.toISOString()
  }

  /**
   * 映射通知类型到user_notifications表的type字段
   */
  private mapNotificationType(notificationType: string): string {
    const typeMap: Record<string, string> = {
      welcome: 'info',
      subscription_expiry: 'warning',
      payment_failed: 'error',
      payment_success: 'success',
      quota_warning: 'warning',
      security_alert: 'error',
      system_update: 'info',
      password_reset: 'info'
    }

    return typeMap[notificationType] || 'info'
  }

  /**
   * 记录通知到统一日志表
   */
  private async logNotification(
    request: NotificationRequest, 
    result: { success: boolean; externalId?: string; error?: string; status: string },
    content?: { title: string; message: string }
  ): Promise<void> {
    try {
      await supabase
        .from('notification_logs_v2')
        .insert({
          user_id: request.userId,
          notification_type: request.type,
          channel_type: request.channelType,
          recipient: request.recipient,
          subject: content?.title || 'In-app notification',
          content_preview: content?.message ? 
            (content.message.length > 100 ? content.message.substring(0, 100) + '...' : content.message) :
            'In-app notification',
          status: result.status,
          external_id: result.externalId,
          error_message: result.error,
          sent_at: new Date().toISOString(),
          metadata: {
            originalRequest: {
              type: request.type,
              priority: request.priority,
              data: request.data
            },
            inAppContent: content,
            channelResult: result
          }
        })
    } catch (error) {
      console.warn('记录应用内通知日志失败:', error)
    }
  }
}