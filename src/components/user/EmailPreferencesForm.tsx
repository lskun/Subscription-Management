// 邮件偏好设置表单组件
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { useToast } from '../../hooks/use-toast'
import { emailNotificationService, EmailPreference, EmailType } from '../../services/emailNotificationService'
import { useAuth } from '../../contexts/AuthContext'

// 邮件类型配置
const EMAIL_TYPE_CONFIG: Record<EmailType, {
  label: string
  description: string
  icon: string
  category: 'account' | 'subscription' | 'security' | 'system'
  defaultEnabled: boolean
}> = {
  welcome: {
    label: '欢迎邮件',
    description: '新用户注册时发送的欢迎邮件',
    icon: '👋',
    category: 'account',
    defaultEnabled: true
  },
  subscription_expiry: {
    label: '订阅到期提醒',
    description: '订阅即将到期时发送的提醒邮件',
    icon: '⏰',
    category: 'subscription',
    defaultEnabled: true
  },
  payment_failed: {
    label: '支付失败通知',
    description: '支付失败时发送的通知邮件',
    icon: '❌',
    category: 'subscription',
    defaultEnabled: true
  },
  payment_success: {
    label: '支付成功确认',
    description: '支付成功时发送的确认邮件',
    icon: '✅',
    category: 'subscription',
    defaultEnabled: true
  },
  quota_warning: {
    label: '配额警告',
    description: '使用量接近限制时发送的警告邮件',
    icon: '⚠️',
    category: 'account',
    defaultEnabled: true
  },
  security_alert: {
    label: '安全警告',
    description: '检测到安全问题时发送的警告邮件',
    icon: '🔒',
    category: 'security',
    defaultEnabled: true
  },
  system_update: {
    label: '系统更新通知',
    description: '系统有重要更新时发送的通知邮件',
    icon: '🚀',
    category: 'system',
    defaultEnabled: false
  },
  password_reset: {
    label: '密码重置',
    description: '密码重置请求时发送的邮件',
    icon: '🔑',
    category: 'security',
    defaultEnabled: true
  }
}

// 分类配置
const CATEGORY_CONFIG = {
  account: { label: '账户相关', color: 'blue' },
  subscription: { label: '订阅管理', color: 'green' },
  security: { label: '安全警告', color: 'red' },
  system: { label: '系统通知', color: 'gray' }
}

interface EmailPreferencesFormProps {
  className?: string
}

export function EmailPreferencesForm({ className }: EmailPreferencesFormProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [preferences, setPreferences] = useState<EmailPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // 加载邮件偏好设置
  useEffect(() => {
    if (user?.id) {
      loadEmailPreferences()
    }
  }, [user?.id])

  const loadEmailPreferences = async () => {
    try {
      setLoading(true)
      const data = await emailNotificationService.getUserEmailPreferences(user!.id)
      setPreferences(data)
    } catch (error) {
      console.error('加载邮件偏好失败:', error)
      toast({
        title: '加载失败',
        description: '无法加载邮件偏好设置，请刷新页面重试',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // 获取特定类型的偏好设置
  const getPreference = (emailType: EmailType): EmailPreference | undefined => {
    return preferences.find(p => p.email_type === emailType)
  }

  // 更新偏好设置
  const updatePreference = (
    emailType: EmailType,
    field: 'enabled' | 'frequency',
    value: boolean | string
  ) => {
    setPreferences(prev => {
      const existing = prev.find(p => p.email_type === emailType)
      if (existing) {
        return prev.map(p => 
          p.email_type === emailType 
            ? { ...p, [field]: value }
            : p
        )
      } else {
        // 创建新的偏好设置
        const newPreference: EmailPreference = {
          id: `temp-${emailType}`,
          user_id: user!.id,
          email_type: emailType,
          enabled: field === 'enabled' ? value as boolean : EMAIL_TYPE_CONFIG[emailType].defaultEnabled,
          frequency: field === 'frequency' ? value as any : 'immediate',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        return [...prev, newPreference]
      }
    })
    setHasChanges(true)
  }

  // 保存设置
  const savePreferences = async () => {
    try {
      setSaving(true)
      
      const updates = preferences.map(pref => ({
        emailType: pref.email_type,
        enabled: pref.enabled,
        frequency: pref.frequency
      }))

      await emailNotificationService.updateEmailPreferences(user!.id, updates)
      
      setHasChanges(false)
      toast({
        title: '保存成功',
        description: '邮件偏好设置已更新'
      })
    } catch (error) {
      console.error('保存邮件偏好失败:', error)
      toast({
        title: '保存失败',
        description: '无法保存邮件偏好设置，请重试',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  // 重置设置
  const resetPreferences = () => {
    loadEmailPreferences()
    setHasChanges(false)
  }

  // 按分类分组邮件类型
  const groupedEmailTypes = Object.entries(EMAIL_TYPE_CONFIG).reduce((acc, [type, config]) => {
    if (!acc[config.category]) {
      acc[config.category] = []
    }
    acc[config.category].push({ type: type as EmailType, config })
    return acc
  }, {} as Record<string, Array<{ type: EmailType; config: typeof EMAIL_TYPE_CONFIG[EmailType] }>>)

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>邮件通知偏好</CardTitle>
          <CardDescription>正在加载设置...</CardDescription>
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
          📧 邮件通知偏好
        </CardTitle>
        <CardDescription>
          管理您希望接收的邮件通知类型和频率
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedEmailTypes).map(([category, emailTypes]) => (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">
                {CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG].label}
              </h3>
              <Badge 
                variant="secondary"
                className={`text-${CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG].color}-600`}
              >
                {emailTypes.length} 项
              </Badge>
            </div>
            
            <div className="space-y-3">
              {emailTypes.map(({ type, config }) => {
                const preference = getPreference(type)
                const isEnabled = preference?.enabled ?? config.defaultEnabled
                const frequency = preference?.frequency ?? 'immediate'
                
                return (
                  <div key={type} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl">{config.icon}</span>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{config.label}</h4>
                          {!config.defaultEnabled && (
                            <Badge variant="outline" className="text-xs">
                              可选
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{config.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {isEnabled && (
                        <Select
                          value={frequency}
                          onValueChange={(value) => updatePreference(type, 'frequency', value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediate">立即发送</SelectItem>
                            <SelectItem value="daily">每日汇总</SelectItem>
                            <SelectItem value="weekly">每周汇总</SelectItem>
                            <SelectItem value="never">从不发送</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => updatePreference(type, 'enabled', checked)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            
            {category !== 'system' && <Separator />}
          </div>
        ))}
        
        {hasChanges && (
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <span className="text-sm font-medium">您有未保存的更改</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetPreferences}
                disabled={saving}
              >
                重置
              </Button>
              <Button
                size="sm"
                onClick={savePreferences}
                disabled={saving}
              >
                {saving ? '保存中...' : '保存设置'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default EmailPreferencesForm