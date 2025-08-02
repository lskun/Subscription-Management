// 用户通知服务
import { supabase } from '../lib/supabase'

// 通知类型定义
export type NotificationType = 
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'subscription'
  | 'payment'
  | 'system'
  | 'security'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

// 通知接口
export interface UserNotification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  priority: NotificationPriority
  is_read: boolean
  is_archived: boolean
  action_url?: string
  action_label?: string
  metadata?: Record<string, any>
  expires_at?: string
  created_at: string
  updated_at: string
}

// 通知创建请求接口
export interface CreateNotificationRequest {
  userId: string
  title: string
  message: string
  type: NotificationType
  priority?: NotificationPriority
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, any>
  expiresAt?: string
}

// 通知偏好设置接口
export interface NotificationPreference {
  id: string
  user_id: string
  notification_type: NotificationType
  enabled: boolean
  push_enabled: boolean
  email_enabled: boolean
  in_app_enabled: boolean
  created_at: string
  updated_at: string
}

// 通知统计接口
export interface NotificationStatistics {
  total_notifications: number
  unread_notifications: number
  active_notifications: number
  urgent_notifications: number
  last_notification_at?: string
}

class NotificationService {
  /**
   * 创建通知
   */
  async createNotification(request: CreateNotificationRequest): Promise<UserNotification> {
    try {
      console.log('创建通知:', request)

      const { data, error } = await supabase
        .from('user_notifications')
        .insert({
          user_id: request.userId,
          title: request.title,
          message: request.message,
          type: request.type,
          priority: request.priority || 'normal',
          action_url: request.actionUrl,
          action_label: request.actionLabel,
          metadata: request.metadata || {},
          expires_at: request.expiresAt
        })
        .select()
        .single()

      if (error) {
        console.error('创建通知失败:', error)
        throw new Error(error.message)
      }

      console.log('通知创建成功:', data.id)
      return data
    } catch (error) {
      console.error('通知服务错误:', error)
      throw error
    }
  }

  /**
   * 创建欢迎通知
   */
  async createWelcomeNotification(userId: string, displayName?: string): Promise<UserNotification> {
    return this.createNotification({
      userId,
      title: '欢迎使用订阅管理器！',
      message: `感谢您注册订阅管理器，${displayName || ''}开始管理您的订阅服务吧！`,
      type: 'info',
      priority: 'normal',
      actionUrl: '/dashboard',
      actionLabel: '开始使用'
    })
  }

  /**
   * 创建订阅到期通知
   */
  async createSubscriptionExpiryNotification(
    userId: string,
    subscriptionName: string,
    daysLeft: number,
    expiryDate: string
  ): Promise<UserNotification> {
    return this.createNotification({
      userId,
      title: `${subscriptionName} 即将到期`,
      message: `您的订阅服务 ${subscriptionName} 将在 ${daysLeft} 天后到期，请及时处理。`,
      type: 'warning',
      priority: 'high',
      actionUrl: '/subscriptions',
      actionLabel: '管理订阅',
      metadata: {
        subscriptionName,
        daysLeft,
        expiryDate
      }
    })
  }

  /**
   * 创建支付失败通知
   */
  async createPaymentFailedNotification(
    userId: string,
    subscriptionName: string,
    amount: number,
    currency: string
  ): Promise<UserNotification> {
    return this.createNotification({
      userId,
      title: `支付失败 - ${subscriptionName}`,
      message: `您的 ${subscriptionName} 支付失败，金额 ${amount} ${currency}，请检查支付信息。`,
      type: 'error',
      priority: 'high',
      actionUrl: '/subscriptions',
      actionLabel: '更新支付信息',
      metadata: {
        subscriptionName,
        amount,
        currency
      }
    })
  }

  /**
   * 创建支付成功通知
   */
  async createPaymentSuccessNotification(
    userId: string,
    subscriptionName: string,
    amount: number,
    currency: string
  ): Promise<UserNotification> {
    return this.createNotification({
      userId,
      title: `支付成功 - ${subscriptionName}`,
      message: `您的 ${subscriptionName} 支付成功，金额 ${amount} ${currency}。`,
      type: 'success',
      priority: 'normal',
      actionUrl: '/payment-history',
      actionLabel: '查看详情',
      metadata: {
        subscriptionName,
        amount,
        currency
      }
    })
  }

  /**
   * 创建配额警告通知
   */
  async createQuotaWarningNotification(
    userId: string,
    feature: string,
    currentUsage: number,
    limit: number,
    percentage: number
  ): Promise<UserNotification> {
    return this.createNotification({
      userId,
      title: `使用配额警告 - ${feature}`,
      message: `您的 ${feature} 使用量已达到 ${percentage}%，当前使用 ${currentUsage}/${limit}。`,
      type: 'warning',
      priority: 'normal',
      actionUrl: '/settings',
      actionLabel: '查看配额',
      metadata: {
        feature,
        currentUsage,
        limit,
        percentage
      }
    })
  }

  /**
   * 创建安全警告通知
   */
  async createSecurityAlertNotification(
    userId: string,
    alertType: string,
    details: string
  ): Promise<UserNotification> {
    return this.createNotification({
      userId,
      title: `安全警告 - ${alertType}`,
      message: `检测到安全问题：${details}，如果不是您的操作，请立即检查账户安全。`,
      type: 'security',
      priority: 'urgent',
      actionUrl: '/settings/security',
      actionLabel: '检查安全设置',
      metadata: {
        alertType,
        details
      }
    })
  }

  /**
   * 创建系统更新通知
   */
  async createSystemUpdateNotification(
    userId: string,
    updateTitle: string,
    updateContent: string
  ): Promise<UserNotification> {
    return this.createNotification({
      userId,
      title: `系统更新 - ${updateTitle}`,
      message: updateContent,
      type: 'system',
      priority: 'low',
      actionUrl: '/dashboard',
      actionLabel: '了解更多',
      metadata: {
        updateTitle,
        updateContent
      }
    })
  }

  /**
   * 获取用户通知列表
   */
  async getUserNotifications(
    userId: string,
    options: {
      includeRead?: boolean
      includeArchived?: boolean
      type?: NotificationType
      priority?: NotificationPriority
      limit?: number
      offset?: number
    } = {}
  ): Promise<{ data: UserNotification[]; count: number }> {
    try {
      let query = supabase
        .from('user_notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)

      // 过滤条件
      if (!options.includeRead) {
        query = query.eq('is_read', false)
      }

      if (!options.includeArchived) {
        query = query.eq('is_archived', false)
      }

      if (options.type) {
        query = query.eq('type', options.type)
      }

      if (options.priority) {
        query = query.eq('priority', options.priority)
      }

      // 过滤过期通知
      query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())

      // 排序和分页
      query = query.order('created_at', { ascending: false })

      if (options.limit) {
        const offset = options.offset || 0
        query = query.range(offset, offset + options.limit - 1)
      }

      const { data, error, count } = await query

      if (error) {
        console.error('获取通知列表失败:', error)
        throw new Error(error.message)
      }

      return { data: data || [], count: count || 0 }
    } catch (error) {
      console.error('获取通知列表错误:', error)
      throw error
    }
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(userId: string, notificationId: string): Promise<UserNotification> {
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('标记通知已读失败:', error)
        throw new Error(error.message)
      }

      return data
    } catch (error) {
      console.error('标记通知已读错误:', error)
      throw error
    }
  }

  /**
   * 批量标记通知为已读
   */
  async markMultipleAsRead(userId: string, notificationIds: string[]): Promise<UserNotification[]> {
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .in('id', notificationIds)
        .select()

      if (error) {
        console.error('批量标记通知已读失败:', error)
        throw new Error(error.message)
      }

      return data || []
    } catch (error) {
      console.error('批量标记通知已读错误:', error)
      throw error
    }
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false)
        .select('id')

      if (error) {
        console.error('标记所有通知已读失败:', error)
        throw new Error(error.message)
      }

      return data?.length || 0
    } catch (error) {
      console.error('标记所有通知已读错误:', error)
      throw error
    }
  }

  /**
   * 归档通知
   */
  async archiveNotification(userId: string, notificationId: string): Promise<UserNotification> {
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .update({ 
          is_archived: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('归档通知失败:', error)
        throw new Error(error.message)
      }

      return data
    } catch (error) {
      console.error('归档通知错误:', error)
      throw error
    }
  }

  /**
   * 删除通知
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId)

      if (error) {
        console.error('删除通知失败:', error)
        throw new Error(error.message)
      }
    } catch (error) {
      console.error('删除通知错误:', error)
      throw error
    }
  }

  /**
   * 获取用户通知统计
   */
  async getUserNotificationStatistics(userId: string): Promise<NotificationStatistics> {
    try {
      const { data, error } = await supabase
        .from('user_notification_statistics')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('获取通知统计失败:', error)
        // 如果没有数据，返回默认统计
        return {
          total_notifications: 0,
          unread_notifications: 0,
          active_notifications: 0,
          urgent_notifications: 0
        }
      }

      return data
    } catch (error) {
      console.error('获取通知统计错误:', error)
      throw error
    }
  }

  /**
   * 获取用户通知偏好设置
   */
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
    try {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .order('notification_type')

      if (error) {
        console.error('获取通知偏好失败:', error)
        throw new Error(error.message)
      }

      return data || []
    } catch (error) {
      console.error('获取通知偏好错误:', error)
      throw error
    }
  }

  /**
   * 更新通知偏好设置
   */
  async updateNotificationPreference(
    userId: string,
    notificationType: NotificationType,
    preferences: {
      enabled?: boolean
      pushEnabled?: boolean
      emailEnabled?: boolean
      inAppEnabled?: boolean
    }
  ): Promise<NotificationPreference> {
    try {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: userId,
          notification_type: notificationType,
          enabled: preferences.enabled,
          push_enabled: preferences.pushEnabled,
          email_enabled: preferences.emailEnabled,
          in_app_enabled: preferences.inAppEnabled,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('更新通知偏好失败:', error)
        throw new Error(error.message)
      }

      return data
    } catch (error) {
      console.error('更新通知偏好错误:', error)
      throw error
    }
  }

  /**
   * 检查用户是否启用了特定类型的应用内通知
   */
  async isInAppNotificationEnabled(userId: string, notificationType: NotificationType): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('enabled, in_app_enabled')
        .eq('user_id', userId)
        .eq('notification_type', notificationType)
        .single()

      if (error) {
        console.warn('检查通知偏好失败，默认启用:', error)
        return true // 默认启用
      }

      return data?.enabled && data?.in_app_enabled
    } catch (error) {
      console.warn('检查通知偏好错误，默认启用:', error)
      return true // 默认启用
    }
  }

  /**
   * 条件创建通知（检查用户偏好）
   */
  async createNotificationIfEnabled(request: CreateNotificationRequest): Promise<UserNotification | null> {
    try {
      // 检查用户是否启用了该类型的应用内通知
      const isEnabled = await this.isInAppNotificationEnabled(request.userId, request.type)
      
      if (!isEnabled) {
        console.log(`用户 ${request.userId} 已禁用 ${request.type} 类型的应用内通知`)
        return null
      }

      return await this.createNotification(request)
    } catch (error) {
      console.error('条件创建通知错误:', error)
      throw error
    }
  }

  /**
   * 清理过期通知
   */
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('cleanup_expired_notifications')

      if (error) {
        console.error('清理过期通知失败:', error)
        throw new Error(error.message)
      }

      console.log(`清理了 ${data} 条过期通知`)
      return data
    } catch (error) {
      console.error('清理过期通知错误:', error)
      throw error
    }
  }
}

// 导出单例实例
export const notificationService = new NotificationService()
export default notificationService