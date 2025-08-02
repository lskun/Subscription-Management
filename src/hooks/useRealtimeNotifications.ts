// 实时通知推送Hook
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../contexts/AuthContext'
import { UserNotification } from '../services/notificationService'
import { useToast } from './use-toast'

interface UseRealtimeNotificationsOptions {
  onNewNotification?: (notification: UserNotification) => void
  enableToast?: boolean
  enableBrowserNotification?: boolean
}

export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions = {}) {
  const { user } = useAuthContext()
  const { toast } = useToast()
  const [isConnected, setIsConnected] = useState(false)
  const [newNotificationCount, setNewNotificationCount] = useState(0)

  const {
    onNewNotification,
    enableToast = true,
    enableBrowserNotification = true
  } = options

  // 请求浏览器通知权限
  const requestNotificationPermission = useCallback(async () => {
    if (!enableBrowserNotification || !('Notification' in window)) {
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      return false
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }, [enableBrowserNotification])

  // 显示浏览器通知
  const showBrowserNotification = useCallback(async (notification: UserNotification) => {
    if (!enableBrowserNotification || !('Notification' in window)) {
      return
    }

    const hasPermission = await requestNotificationPermission()
    if (!hasPermission) {
      return
    }

    try {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.priority === 'urgent',
        silent: notification.priority === 'low'
      })

      // 点击通知时的处理
      browserNotification.onclick = () => {
        window.focus()
        if (notification.action_url) {
          window.location.href = notification.action_url
        }
        browserNotification.close()
      }

      // 自动关闭通知
      setTimeout(() => {
        browserNotification.close()
      }, 5000)
    } catch (error) {
      console.warn('显示浏览器通知失败:', error)
    }
  }, [enableBrowserNotification, requestNotificationPermission])

  // 显示Toast通知
  const showToastNotification = useCallback((notification: UserNotification) => {
    if (!enableToast) return

    const variant = notification.type === 'error' || notification.type === 'security' 
      ? 'destructive' 
      : 'default'

    toast({
      title: notification.title,
      description: notification.message,
      variant,
      action: notification.action_url && notification.action_label ? {
        altText: notification.action_label,
        onClick: () => {
          window.location.href = notification.action_url!
        }
      } : undefined
    })
  }, [enableToast, toast])

  // 处理新通知
  const handleNewNotification = useCallback((notification: UserNotification) => {
    console.log('收到新通知:', notification)

    // 增加新通知计数
    setNewNotificationCount(prev => prev + 1)

    // 显示Toast通知
    showToastNotification(notification)

    // 显示浏览器通知
    showBrowserNotification(notification)

    // 调用自定义回调
    onNewNotification?.(notification)
  }, [showToastNotification, showBrowserNotification, onNewNotification])

  // 设置实时订阅
  useEffect(() => {
    if (!user?.id) {
      return
    }

    console.log('设置实时通知订阅:', user.id)

    // 订阅用户通知表的变化
    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('实时通知数据:', payload)
          const notification = payload.new as UserNotification
          handleNewNotification(notification)
        }
      )
      .subscribe((status) => {
        console.log('实时通知订阅状态:', status)
        setIsConnected(status === 'SUBSCRIBED')
      })

    // 清理订阅
    return () => {
      console.log('清理实时通知订阅')
      supabase.removeChannel(channel)
      setIsConnected(false)
    }
  }, [user?.id, handleNewNotification])

  // 重置新通知计数
  const resetNewNotificationCount = useCallback(() => {
    setNewNotificationCount(0)
  }, [])

  // 手动请求通知权限
  const requestPermission = useCallback(async () => {
    return await requestNotificationPermission()
  }, [requestNotificationPermission])

  return {
    isConnected,
    newNotificationCount,
    resetNewNotificationCount,
    requestPermission
  }
}