// 短信通知渠道实现
import { supabase } from '@/lib/supabase'
import { 
  NotificationChannel, 
  NotificationRequest, 
  NotificationResult,
  ChannelConfig,
  DeliveryStatus 
} from './index'

export class SMSChannel implements NotificationChannel {
  public readonly channelType = 'sms' as const

  /**
   * 发送短信通知
   */
  async send(request: NotificationRequest): Promise<NotificationResult> {
    try {
      console.log('短信渠道 - 发送通知:', request)

      // 验证手机号格式
      if (!this.isValidPhoneNumber(request.recipient)) {
        throw new Error(`Invalid phone number: ${request.recipient}`)
      }

      // 检查渠道是否启用
      const enabled = await this.isEnabled()
      if (!enabled) {
        throw new Error('SMS channel is not enabled')
      }

      // TODO: 实现短信发送逻辑
      // 这里可以集成Twilio、阿里云短信、腾讯云短信等服务
      const result = await this.sendSMSViaProvider(request)

      // 记录到统一日志表
      await this.logNotification(request, {
        success: result.success,
        externalId: result.externalId,
        error: result.error,
        status: result.success ? 'sent' : 'failed'
      })

      return {
        success: result.success,
        message: result.success ? 'SMS notification sent successfully' : 'SMS notification failed',
        notificationId: result.externalId,
        error: result.error,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('短信渠道发送失败:', error)
      
      // 记录失败日志
      await this.logNotification(request, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed'
      })

      return {
        success: false,
        message: 'SMS notification failed',
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
      if (!config.provider) return false
      
      switch (config.provider) {
        case 'twilio':
          return !!(config.accountSid && config.authToken && config.fromNumber)
        case 'aliyun':
          return !!(config.accessKeyId && config.accessKeySecret && config.signName)
        case 'tencent':
          return !!(config.secretId && config.secretKey && config.appId)
        default:
          return false
      }
    } catch (error) {
      console.error('短信渠道配置验证失败:', error)
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
        .select('is_enabled, config')
        .eq('channel_type', 'sms')
        .single()

      if (error) {
        console.warn('检查短信渠道状态失败:', error)
        return false
      }

      return data?.is_enabled && this.validate(data.config || {})
    } catch (error) {
      console.error('检查短信渠道启用状态失败:', error)
      return false
    }
  }

  /**
   * 获取投递状态
   */
  async getDeliveryStatus(externalId: string): Promise<DeliveryStatus> {
    try {
      // 查询统一日志表获取状态
      const { data, error } = await supabase
        .from('notification_logs_v2')
        .select('status, sent_at, error_message')
        .eq('external_id', externalId)
        .eq('channel_type', 'sms')
        .single()

      if (error || !data) {
        throw new Error('SMS delivery status not found')
      }

      return {
        status: data.status,
        timestamp: data.sent_at,
        details: data.error_message
      }
    } catch (error) {
      console.error('获取短信投递状态失败:', error)
      throw error
    }
  }

  /**
   * 通过服务提供商发送短信
   */
  private async sendSMSViaProvider(request: NotificationRequest): Promise<{
    success: boolean
    externalId?: string
    error?: string
  }> {
    try {
      // 获取渠道配置
      const { data: channelConfig } = await supabase
        .from('notification_channels')
        .select('config')
        .eq('channel_type', 'sms')
        .single()

      const config = channelConfig?.config || {}

      // 获取短信模板并渲染内容
      const content = await this.renderSMSContent(request)
      
      // 根据不同提供商发送
      switch (config.provider) {
        case 'twilio':
          return await this.sendViaTwilio(request.recipient, content, config)
        case 'aliyun':
          return await this.sendViaAliyun(request.recipient, content, config)
        case 'tencent':
          return await this.sendViaTencent(request.recipient, content, config)
        default:
          // 暂时返回模拟成功，实际项目中应该抛出错误
          console.log('短信发送模拟 - 收件人:', request.recipient, '内容:', content)
          return {
            success: false,
            error: 'SMS provider not implemented'
          }
      }
    } catch (error) {
      console.error('发送短信失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 渲染短信内容
   */
  private async renderSMSContent(request: NotificationRequest): Promise<string> {
    try {
      // 获取短信模板
      const { data: template } = await supabase
        .from('unified_notification_templates')
        .select('text_template')
        .eq('notification_type', request.type)
        .eq('channel_type', 'sms')
        .eq('is_active', true)
        .single()

      if (!template || !template.text_template) {
        throw new Error(`SMS template not found for type: ${request.type}`)
      }

      // 替换模板变量
      let content = template.text_template
      const variables = request.data || {}
      
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g')
        content = content.replace(regex, String(value || ''))
      }

      return content
    } catch (error) {
      console.error('渲染短信内容失败:', error)
      throw error
    }
  }

  /**
   * 通过Twilio发送短信
   */
  private async sendViaTwilio(to: string, content: string, config: any): Promise<{
    success: boolean
    externalId?: string
    error?: string
  }> {
    // TODO: 实现Twilio集成
    console.log('Twilio短信发送 - 待实现', { to, content, config })
    return {
      success: false,
      error: 'Twilio integration not implemented'
    }
  }

  /**
   * 通过阿里云发送短信
   */
  private async sendViaAliyun(to: string, content: string, config: any): Promise<{
    success: boolean
    externalId?: string
    error?: string
  }> {
    // TODO: 实现阿里云短信集成
    console.log('阿里云短信发送 - 待实现', { to, content, config })
    return {
      success: false,
      error: 'Aliyun SMS integration not implemented'
    }
  }

  /**
   * 通过腾讯云发送短信
   */
  private async sendViaTencent(to: string, content: string, config: any): Promise<{
    success: boolean
    externalId?: string
    error?: string
  }> {
    // TODO: 实现腾讯云短信集成
    console.log('腾讯云短信发送 - 待实现', { to, content, config })
    return {
      success: false,
      error: 'Tencent SMS integration not implemented'
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
          subject: `SMS: ${request.type}`,
          content_preview: await this.getContentPreview(request),
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
            channelResult: result
          }
        })
    } catch (error) {
      console.warn('记录短信通知日志失败:', error)
    }
  }

  /**
   * 获取内容预览
   */
  private async getContentPreview(request: NotificationRequest): Promise<string> {
    try {
      const content = await this.renderSMSContent(request)
      return content.length > 100 ? content.substring(0, 100) + '...' : content
    } catch (error) {
      return `SMS notification: ${request.type}`
    }
  }

  /**
   * 验证手机号格式
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // 简单的手机号验证，支持国际格式
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    return phoneRegex.test(phoneNumber.replace(/[\s-()]/g, ''))
  }
}