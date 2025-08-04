// 通知中心组件
import React, { useState, useEffect } from 'react'
import { Bell, Check, Archive, Trash2, Settings, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Separator } from '../ui/separator'
import { ScrollArea } from '../ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { useToast } from '../../hooks/use-toast'
import { notificationService, UserNotification, NotificationStatistics } from '../../services/notificationService'
import { useAuth } from '../../contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

// 通知类型配置
const NOTIFICATION_TYPE_CONFIG = {
  info: { label: '信息', color: 'blue', icon: 'ℹ️' },
  success: { label: '成功', color: 'green', icon: '✅' },
  warning: { label: '警告', color: 'yellow', icon: '⚠️' },
  error: { label: '错误', color: 'red', icon: '❌' },
  subscription: { label: '订阅', color: 'purple', icon: '📱' },
  payment: { label: '支付', color: 'emerald', icon: '💳' },
  system: { label: '系统', color: 'gray', icon: '🔧' },
  security: { label: '安全', color: 'red', icon: '🔒' }
}

// 优先级配置
const PRIORITY_CONFIG = {
  low: { label: '低', color: 'gray' },
  normal: { label: '普通', color: 'blue' },
  high: { label: '高', color: 'orange' },
  urgent: { label: '紧急', color: 'red' }
}

interface NotificationCenterProps {
  className?: string
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [statistics, setStatistics] = useState<NotificationStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('unread')

  // 加载通知数据
  useEffect(() => {
    if (user?.id && isOpen) {
      loadNotifications()
      loadStatistics()
    }
  }, [user?.id, isOpen, activeTab])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const options = {
        includeRead: activeTab === 'all',
        includeArchived: false,
        limit: 50
      }
      
      const { data } = await notificationService.getUserNotifications(user!.id, options)
      setNotifications(data)
    } catch (error) {
      console.error('加载通知失败:', error)
      toast({
        title: '加载失败',
        description: '无法加载通知，请刷新页面重试',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadStatistics = async () => {
    try {
      const stats = await notificationService.getUserNotificationStatistics(user!.id)
      setStatistics(stats)
    } catch (error) {
      console.error('加载通知统计失败:', error)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(user!.id, notificationId)
      
      // 更新本地状态
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true }
            : n
        )
      )
      
      // 更新统计
      loadStatistics()
    } catch (error) {
      console.error('标记已读失败:', error)
      toast({
        title: '操作失败',
        description: '无法标记通知为已读',
        variant: 'destructive'
      })
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const count = await notificationService.markAllAsRead(user!.id)
      
      // 更新本地状态
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      )
      
      // 更新统计
      loadStatistics()
      
      toast({
        title: '操作成功',
        description: `已标记 ${count} 条通知为已读`
      })
    } catch (error) {
      console.error('标记所有已读失败:', error)
      toast({
        title: '操作失败',
        description: '无法标记所有通知为已读',
        variant: 'destructive'
      })
    }
  }

  const handleArchive = async (notificationId: string) => {
    try {
      await notificationService.archiveNotification(user!.id, notificationId)
      
      // 从列表中移除
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      
      // 更新统计
      loadStatistics()
      
      toast({
        title: '已归档',
        description: '通知已归档'
      })
    } catch (error) {
      console.error('归档通知失败:', error)
      toast({
        title: '操作失败',
        description: '无法归档通知',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(user!.id, notificationId)
      
      // 从列表中移除
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      
      // 更新统计
      loadStatistics()
      
      toast({
        title: '已删除',
        description: '通知已删除'
      })
    } catch (error) {
      console.error('删除通知失败:', error)
      toast({
        title: '操作失败',
        description: '无法删除通知',
        variant: 'destructive'
      })
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: zhCN
      })
    } catch {
      return '未知时间'
    }
  }

  const getNotificationIcon = (type: UserNotification['type']) => {
    return NOTIFICATION_TYPE_CONFIG[type]?.icon || '📢'
  }

  const getPriorityBadge = (priority: UserNotification['priority']) => {
    const config = PRIORITY_CONFIG[priority]
    if (priority === 'low' || priority === 'normal') return null
    
    return (
      <Badge 
        variant={priority === 'urgent' ? 'destructive' : 'secondary'}
        className="text-xs"
      >
        {config.label}
      </Badge>
    )
  }

  const unreadCount = statistics?.unread_notifications || 0

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={`relative ${className}`}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">通知中心</CardTitle>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="text-xs"
                  >
                    全部已读
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {statistics && (
              <div className="flex gap-4 text-sm text-gray-600">
                <span>总计: {statistics.total_notifications}</span>
                <span>未读: {statistics.unread_notifications}</span>
                {statistics.urgent_notifications > 0 && (
                  <span className="text-red-600">紧急: {statistics.urgent_notifications}</span>
                )}
              </div>
            )}
          </CardHeader>
          
          <Separator />
          
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="unread">未读</TabsTrigger>
                <TabsTrigger value="all">全部</TabsTrigger>
              </TabsList>
              
              <TabsContent value={activeTab} className="mt-0">
                <ScrollArea className="h-96">
                  {loading ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                          <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                            <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>暂无通知</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`group flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors ${
                            !notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                          }`}
                        >
                          <div className="text-2xl flex-shrink-0">
                            {getNotificationIcon(notification.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className={`text-sm font-medium truncate ${
                                    !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                                  }`}>
                                    {notification.title}
                                  </h4>
                                  {getPriorityBadge(notification.priority)}
                                </div>
                                
                                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                  {notification.message}
                                </p>
                                
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-400">
                                    {formatDate(notification.created_at)}
                                  </span>
                                  
                                  {notification.action_url && notification.action_label && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-6 px-2"
                                      onClick={() => {
                                        window.location.href = notification.action_url!
                                        setIsOpen(false)
                                      }}
                                    >
                                      {notification.action_label}
                                    </Button>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!notification.is_read && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleMarkAsRead(notification.id)}
                                    title="标记为已读"
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                )}
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleArchive(notification.id)}
                                  title="归档"
                                >
                                  <Archive className="h-3 w-3" />
                                </Button>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  onClick={() => handleDelete(notification.id)}
                                  title="删除"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
          
          <Separator />
          
          <div className="p-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                // 这里可以导航到通知设置页面
                setIsOpen(false)
              }}
            >
              <Settings className="h-4 w-4 mr-2" />
              通知设置
            </Button>
          </div>
        </Card>
      </PopoverContent>
    </Popover>
  )
}

export default NotificationCenter