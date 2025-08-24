// 邮件通知渠道实现
import { supabaseGateway } from '@/utils/supabase-gateway'
import { supabase } from '@/lib/supabase'
import { 
  NotificationChannel, 
  NotificationRequest, 
  NotificationResult,
  ChannelConfig,
  DeliveryStatus 
} from './index'

export class EmailChannel implements NotificationChannel {
  public readonly channelType = 'email' as const

  /**
   * 发送邮件通知
   */
  async send(request: NotificationRequest): Promise<NotificationResult> {
    try {
      console.log('邮件渠道 - 发送通知:', request)

      // 验证邮件地址格式
      if (!this.isValidEmail(request.recipient)) {
        throw new Error(`Invalid email address: ${request.recipient}`)
      }

      // 调用现有的邮件发送Edge Function
      const { data, error } = await supabaseGateway.invokeFunction('send-notification-email', {
        body: {
          userId: request.userId,
          email: request.recipient,
          type: request.type,
          data: request.data || {},
          templateOverride: request.templateOverride
        }
      })

      if (error) {
        throw new Error(error.message || 'Email sending failed')
      }

      // 记录到新的统一日志表
      await this.logNotification(request, {
        success: true,
        externalId: data?.emailId,
        status: 'sent'
      })

      return {
        success: true,
        message: 'Email notification sent successfully',
        notificationId: data?.emailId,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('邮件渠道发送失败:', error)
      
      // 记录失败日志
      await this.logNotification(request, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed'
      })

      return {
        success: false,
        message: 'Email notification failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * 验证配置
   */
  validate(config: ChannelConfig): boolean {
    try {
      // 检查基本配置
      if (!config.provider) return false
      if (!config.fromEmail || !this.isValidEmail(config.fromEmail)) return false
      
      // 根据不同提供商验证
      switch (config.provider) {
        case 'resend':
          return !!config.apiKey
        case 'sendgrid':
          return !!config.apiKey
        case 'mailgun':
          return !!(config.apiKey && config.domain)
        default:
          return false
      }
    } catch (error) {
      console.error('邮件渠道配置验证失败:', error)
      return false
    }
  }

  /**
   * 检查渠道是否启用
   */
  async isEnabled(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('notification_channels')
        .select('is_enabled')
        .eq('channel_type', 'email')
        .single()

      if (error) {
        console.warn('检查邮件渠道状态失败:', error)
        return false
      }

      return data?.is_enabled || false
    } catch (error) {
      console.error('检查邮件渠道启用状态失败:', error)
      return false
    }
  }

  /**
   * 获取投递状态（可选实现）
   */
  async getDeliveryStatus(externalId: string): Promise<DeliveryStatus> {
    try {
      // 查询现有的email_logs表获取状态
      const { data, error } = await supabase
        .from('email_logs')
        .select('status, sent_at, error_message')
        .eq('external_email_id', externalId)
        .single()

      if (error || !data) {
        throw new Error('Delivery status not found')
      }

      return {
        status: this.mapEmailStatus(data.status),
        timestamp: data.sent_at,
        details: data.error_message
      }
    } catch (error) {
      console.error('获取邮件投递状态失败:', error)
      throw error
    }
  }

  /**
   * 记录通知到统一日志表
   */
  private async logNotification(
    request: NotificationRequest, 
    result: { success: boolean; externalId?: string; error?: string; status: string }
  ): Promise<void> {
    try {
      await supabase
        .from('notification_logs_v2')
        .insert({
          user_id: request.userId,
          notification_type: request.type,
          channel_type: request.channelType,
          recipient: request.recipient,
          subject: request.templateOverride?.subject || '',
          content_preview: this.getContentPreview(request.templateOverride?.html || request.templateOverride?.text || ''),
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
            provider: 'resend', // 暂时硬编码
            channelResult: result
          }
        })
    } catch (error) {
      console.warn('记录通知日志失败:', error)
      // 不抛出错误，避免影响主要流程
    }
  }

  /**
   * 验证邮件地址格式
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * 获取内容预览（前100字符）
   */
  private getContentPreview(content: string): string {
    if (!content) return ''
    
    // 移除HTML标签
    const plainText = content.replace(/<[^>]*>/g, '').trim()
    return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText
  }

  /**
   * 映射邮件状态到统一状态
   */
  private mapEmailStatus(emailStatus: string): 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked' {
    switch (emailStatus) {
      case 'sent': return 'sent'
      case 'delivered': return 'delivered'
      case 'failed': return 'failed'
      case 'bounced': return 'bounced'
      case 'opened': return 'opened'
      case 'clicked': return 'clicked'
      default: return 'sent'
    }
  }
}