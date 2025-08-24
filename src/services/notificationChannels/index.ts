// 通知渠道接口和实现
import { 
  NotificationChannelType, 
  NotificationRequest, 
  NotificationResult 
} from '../unifiedNotificationService'

// 重新导出类型
export type { 
  NotificationChannelType, 
  NotificationRequest, 
  NotificationResult 
} from '../unifiedNotificationService'

// 通知渠道基础接口
export interface NotificationChannel {
  channelType: NotificationChannelType
  send(request: NotificationRequest): Promise<NotificationResult>
  validate(config: any): boolean
  isEnabled(): Promise<boolean>
  getDeliveryStatus?(externalId: string): Promise<DeliveryStatus>
}

// 发送结果接口
export interface SendResult {
  success: boolean
  externalId?: string
  error?: string
  metadata?: Record<string, any>
}

// 投递状态接口
export interface DeliveryStatus {
  status: 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked'
  timestamp: string
  details?: string
}

// 渠道配置接口
export interface ChannelConfig {
  provider?: string
  apiKey?: string
  endpoint?: string
  fromEmail?: string
  fromName?: string
  [key: string]: any
}

// 导出所有渠道实现
export { EmailChannel } from './EmailChannel'
export { SMSChannel } from './SMSChannel'
export { PushChannel } from './PushChannel'
export { InAppChannel } from './InAppChannel'