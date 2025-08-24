// 统一通知偏好设置表单 - 支持多渠道通知管理
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { useToast } from '../../hooks/use-toast'
import { 
  unifiedNotificationService, 
  NotificationType, 
  NotificationChannelType,
  UserNotificationPreferences 
} from '../../services/unifiedNotificationService'
import { useAuth } from '../../contexts/AuthContext'

// 通知类型配置
const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, {
  label: string
  description: string
  icon: string
  category: 'account' | 'subscription' | 'security' | 'system'
  defaultEnabled: boolean
  supportedChannels: NotificationChannelType[]
}> = {
  welcome: {
    label: 'Welcome Messages',
    description: 'Welcome messages sent when new users register',
    icon: '👋',
    category: 'account',
    defaultEnabled: true,
    supportedChannels: ['email', 'in_app']
  },
  subscription_expiry: {
    label: 'Subscription Expiry Reminders',
    description: 'Reminders sent when subscription is about to expire',
    icon: '⏰',
    category: 'subscription',
    defaultEnabled: true,
    supportedChannels: ['email', 'sms', 'push', 'in_app']
  },
  payment_failed: {
    label: 'Payment Failed Notifications',
    description: 'Notifications sent when payment fails',
    icon: '❌',
    category: 'subscription',
    defaultEnabled: true,
    supportedChannels: ['email', 'sms', 'in_app']
  },
  payment_success: {
    label: 'Payment Success Confirmations',
    description: 'Confirmations sent when payment succeeds',
    icon: '✅',
    category: 'subscription',
    defaultEnabled: true,
    supportedChannels: ['email', 'in_app']
  },
  quota_warning: {
    label: 'Quota Warnings',
    description: 'Warnings sent when usage approaches limit',
    icon: '⚠️',
    category: 'account',
    defaultEnabled: true,
    supportedChannels: ['email', 'push', 'in_app']
  },
  security_alert: {
    label: 'Security Alerts',
    description: 'Alerts sent when security issues are detected',
    icon: '🔒',
    category: 'security',
    defaultEnabled: true,
    supportedChannels: ['email', 'sms', 'in_app']
  },
  system_update: {
    label: 'System Update Notifications',
    description: 'Notifications sent when system has important updates',
    icon: '🚀',
    category: 'system',
    defaultEnabled: false,
    supportedChannels: ['email', 'push', 'in_app']
  },
  password_reset: {
    label: 'Password Reset',
    description: 'Messages sent when password reset is requested',
    icon: '🔑',
    category: 'security',
    defaultEnabled: true,
    supportedChannels: ['email']
  }
}

// 渠道配置
const CHANNEL_CONFIG: Record<NotificationChannelType, {
  label: string
  icon: string
  description: string
  recipientLabel: string
}> = {
  email: {
    label: 'Email',
    icon: '📧',
    description: 'Receive notifications via email',
    recipientLabel: 'Email Address'
  },
  sms: {
    label: 'SMS',
    icon: '📱',
    description: 'Receive notifications via text message',
    recipientLabel: 'Phone Number'
  },
  push: {
    label: 'Push',
    icon: '🔔',
    description: 'Receive push notifications on your devices',
    recipientLabel: 'Device'
  },
  in_app: {
    label: 'In-App',
    icon: '🔔',
    description: 'Receive notifications within the application',
    recipientLabel: 'Account'
  }
}

// 分类配置
const CATEGORY_CONFIG = {
  account: { label: 'Account Related', color: 'blue' },
  subscription: { label: 'Subscription Management', color: 'green' },
  security: { label: 'Security Alerts', color: 'red' },
  system: { label: 'System Notifications', color: 'gray' }
}

interface UnifiedNotificationPreferencesFormProps {
  className?: string
}

export function UnifiedNotificationPreferencesForm({ className }: UnifiedNotificationPreferencesFormProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [preferences, setPreferences] = useState<UserNotificationPreferences[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [quietHours, setQuietHours] = useState({
    start: '22:00',
    end: '08:00'
  })

  // 加载通知偏好
  useEffect(() => {
    if (user?.id) {
      loadNotificationPreferences()
    }
  }, [user?.id])

  const loadNotificationPreferences = async () => {
    try {
      setLoading(true)
      const data = await unifiedNotificationService.getUserNotificationPreferences(user!.id)
      setPreferences(data)
      
      // 设置静默时间（从第一个偏好中获取）
      if (data.length > 0 && data[0].quietHoursStart && data[0].quietHoursEnd) {
        setQuietHours({
          start: data[0].quietHoursStart,
          end: data[0].quietHoursEnd
        })
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error)
      toast({
        title: 'Loading Failed',
        description: 'Unable to load notification preferences, please refresh the page and try again',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // 获取特定类型和渠道的偏好
  const getPreference = (
    notificationType: NotificationType, 
    channelType: NotificationChannelType
  ): UserNotificationPreferences | undefined => {
    return preferences.find(p => 
      p.notificationType === notificationType && 
      p.channelType === channelType
    )
  }

  // 更新偏好
  const updatePreference = (
    notificationType: NotificationType,
    channelType: NotificationChannelType,
    field: 'enabled' | 'frequency',
    value: boolean | string
  ) => {
    setPreferences(prev => {
      const existing = prev.find(p => 
        p.notificationType === notificationType && 
        p.channelType === channelType
      )
      
      if (existing) {
        return prev.map(p => 
          p.notificationType === notificationType && p.channelType === channelType
            ? { ...p, [field]: value }
            : p
        )
      } else {
        // 创建新偏好
        const newPreference: UserNotificationPreferences = {
          userId: user!.id,
          notificationType,
          channelType,
          enabled: field === 'enabled' ? value as boolean : NOTIFICATION_TYPE_CONFIG[notificationType].defaultEnabled,
          frequency: field === 'frequency' ? value as any : 'immediate',
          quietHoursStart: quietHours.start,
          quietHoursEnd: quietHours.end
        }
        return [...prev, newPreference]
      }
    })
    setHasChanges(true)
  }

  // 更新静默时间
  const updateQuietHours = (start: string, end: string) => {
    setQuietHours({ start, end })
    setPreferences(prev => prev.map(p => ({
      ...p,
      quietHoursStart: start,
      quietHoursEnd: end
    })))
    setHasChanges(true)
  }

  // 保存偏好
  const savePreferences = async () => {
    try {
      setSaving(true)
      await unifiedNotificationService.updateUserNotificationPreferences(preferences)
      
      setHasChanges(false)
      toast({
        title: 'Save Successful',
        description: 'Notification preferences have been updated'
      })
    } catch (error) {
      console.error('Failed to save notification preferences:', error)
      toast({
        title: 'Save Failed',
        description: 'Unable to save notification preferences, please try again',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  // 重置偏好
  const resetPreferences = () => {
    loadNotificationPreferences()
    setHasChanges(false)
  }

  // 批量启用/禁用渠道
  const toggleChannelForAllTypes = (channelType: NotificationChannelType, enabled: boolean) => {
    Object.keys(NOTIFICATION_TYPE_CONFIG).forEach(type => {
      const notificationType = type as NotificationType
      const config = NOTIFICATION_TYPE_CONFIG[notificationType]
      
      if (config.supportedChannels.includes(channelType)) {
        updatePreference(notificationType, channelType, 'enabled', enabled)
      }
    })
  }

  // 按分类分组通知类型
  const groupedNotificationTypes = Object.entries(NOTIFICATION_TYPE_CONFIG).reduce((acc, [type, config]) => {
    if (!acc[config.category]) {
      acc[config.category] = []
    }
    acc[config.category].push({ type: type as NotificationType, config })
    return acc
  }, {} as Record<string, Array<{ type: NotificationType; config: typeof NOTIFICATION_TYPE_CONFIG[NotificationType] }>>)

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Loading settings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded w-48 animate-pulse" />
                </div>
                <div className="h-6 bg-gray-200 rounded w-12 animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔔 Notification Preferences
        </CardTitle>
        <CardDescription>
          Manage how and when you receive notifications across different channels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="by-type">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="by-type">By Type</TabsTrigger>
            <TabsTrigger value="by-channel">By Channel</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* 按类型管理 */}
          <TabsContent value="by-type" className="space-y-6">
            {Object.entries(groupedNotificationTypes).map(([category, notificationTypes]) => (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">
                    {CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG].label}
                  </h3>
                  <Badge variant="secondary">
                    {notificationTypes.length} types
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {notificationTypes.map(({ type, config }) => (
                    <div key={type} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{config.icon}</span>
                        <div className="flex-1">
                          <h4 className="font-medium">{config.label}</h4>
                          <p className="text-sm text-gray-600">{config.description}</p>
                          
                          {/* 渠道设置 */}
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                            {config.supportedChannels.map(channelType => {
                              const preference = getPreference(type, channelType)
                              const isEnabled = preference?.enabled ?? config.defaultEnabled
                              const frequency = preference?.frequency ?? 'immediate'
                              
                              return (
                                <div key={channelType} className="flex items-center gap-2 p-2 border rounded">
                                  <span className="text-sm">{CHANNEL_CONFIG[channelType].icon}</span>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1">
                                      <Switch
                                        checked={isEnabled}
                                        onCheckedChange={(checked) => 
                                          updatePreference(type, channelType, 'enabled', checked)
                                        }
                                        className="scale-75"
                                      />
                                      <span className="text-xs">{CHANNEL_CONFIG[channelType].label}</span>
                                    </div>
                                    {isEnabled && (
                                      <Select
                                        value={frequency}
                                        onValueChange={(value) => 
                                          updatePreference(type, channelType, 'frequency', value)
                                        }
                                      >
                                        <SelectTrigger className="h-6 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="immediate">Immediate</SelectItem>
                                          <SelectItem value="daily">Daily</SelectItem>
                                          <SelectItem value="weekly">Weekly</SelectItem>
                                          <SelectItem value="never">Never</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {category !== 'system' && <Separator />}
              </div>
            ))}
          </TabsContent>

          {/* 按渠道管理 */}
          <TabsContent value="by-channel" className="space-y-6">
            {Object.entries(CHANNEL_CONFIG).map(([channelType, channelConfig]) => {
              const typedChannelType = channelType as NotificationChannelType
              const enabledCount = preferences.filter(p => 
                p.channelType === typedChannelType && p.enabled
              ).length
              
              return (
                <div key={channelType} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{channelConfig.icon}</span>
                      <div>
                        <h3 className="font-semibold">{channelConfig.label} Notifications</h3>
                        <p className="text-sm text-gray-600">{channelConfig.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{enabledCount} enabled</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleChannelForAllTypes(typedChannelType, true)}
                      >
                        Enable All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleChannelForAllTypes(typedChannelType, false)}
                      >
                        Disable All
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(NOTIFICATION_TYPE_CONFIG)
                      .filter(([, config]) => config.supportedChannels.includes(typedChannelType))
                      .map(([type, config]) => {
                        const notificationType = type as NotificationType
                        const preference = getPreference(notificationType, typedChannelType)
                        const isEnabled = preference?.enabled ?? config.defaultEnabled
                        const frequency = preference?.frequency ?? 'immediate'
                        
                        return (
                          <div key={type} className="flex items-center justify-between p-3 border rounded">
                            <div className="flex items-center gap-2">
                              <span>{config.icon}</span>
                              <span className="text-sm">{config.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isEnabled && (
                                <Select
                                  value={frequency}
                                  onValueChange={(value) => 
                                    updatePreference(notificationType, typedChannelType, 'frequency', value)
                                  }
                                >
                                  <SelectTrigger className="w-24 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="immediate">Now</SelectItem>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="never">Never</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => 
                                  updatePreference(notificationType, typedChannelType, 'enabled', checked)
                                }
                              />
                            </div>
                          </div>
                        )
                      })
                    }
                  </div>
                </div>
              )
            })}
          </TabsContent>

          {/* 全局设置 */}
          <TabsContent value="settings" className="space-y-6">
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Quiet Hours</h3>
              <p className="text-sm text-gray-600">
                Set times when you don't want to receive notifications
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quiet-start">Start Time</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={quietHours.start}
                    onChange={(e) => updateQuietHours(e.target.value, quietHours.end)}
                  />
                </div>
                <div>
                  <Label htmlFor="quiet-end">End Time</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={quietHours.end}
                    onChange={(e) => updateQuietHours(quietHours.start, e.target.value)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        {hasChanges && (
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <span className="text-sm font-medium">You have unsaved changes</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetPreferences}
                disabled={saving}
              >
                Reset
              </Button>
              <Button
                size="sm"
                onClick={savePreferences}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default UnifiedNotificationPreferencesForm