import React, { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { Save, Loader2, Bell, Shield, Palette, DollarSign } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

import { UserProfileService } from '@/services/userProfileService'
import type { UserPreferences } from '@/types/userProfile'

interface UserPreferencesFormProps {
  user: User
  onPreferencesUpdate?: (preferences: UserPreferences) => void
}

// 支持的货币列表
const SUPPORTED_CURRENCIES = [
  { value: 'CNY', label: '人民币 (¥)', symbol: '¥' },
  { value: 'USD', label: '美元 ($)', symbol: '$' },
  { value: 'EUR', label: '欧元 (€)', symbol: '€' },
  { value: 'GBP', label: '英镑 (£)', symbol: '£' },
  { value: 'JPY', label: '日元 (¥)', symbol: '¥' },
  { value: 'KRW', label: '韩元 (₩)', symbol: '₩' },
  { value: 'HKD', label: '港币 (HK$)', symbol: 'HK$' },
  { value: 'SGD', label: '新加坡元 (S$)', symbol: 'S$' },
  { value: 'AUD', label: '澳元 (A$)', symbol: 'A$' },
  { value: 'CAD', label: '加元 (C$)', symbol: 'C$' }
] as const

export function UserPreferencesForm({ user, onPreferencesUpdate }: UserPreferencesFormProps) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 加载用户偏好设置
  useEffect(() => {
    loadUserPreferences()
  }, [user.id])

  const loadUserPreferences = async () => {
    try {
      setLoading(true)
      const userPreferences = await UserProfileService.getUserPreferences(user.id)
      setPreferences(userPreferences)
    } catch (error) {
      console.error('加载用户偏好设置失败:', error)
      toast.error('加载偏好设置失败')
    } finally {
      setLoading(false)
    }
  }

  // 更新偏好设置
  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    if (!preferences) return
    
    setPreferences(prev => ({
      ...prev!,
      [key]: value
    }))
  }

  // 更新嵌套的偏好设置
  const updateNestedPreference = <
    K extends keyof UserPreferences,
    NK extends keyof UserPreferences[K]
  >(
    key: K,
    nestedKey: NK,
    value: UserPreferences[K][NK]
  ) => {
    if (!preferences) return
    
    setPreferences(prev => {
      if (!prev) return prev
      const currentValue = prev[key]
      if (typeof currentValue === 'object' && currentValue !== null) {
        return {
          ...prev,
          [key]: {
            ...currentValue,
            [nestedKey]: value
          }
        }
      }
      return prev
    })
  }

  // 保存偏好设置
  const handleSave = async () => {
    if (!preferences) return

    try {
      setSaving(true)
      const updatedPreferences = await UserProfileService.updateUserPreferences(preferences, user.id)
      
      // 更新本地状态为服务器返回的最新数据
      setPreferences(updatedPreferences)
      
      toast.success('偏好设置已保存')
      onPreferencesUpdate?.(updatedPreferences)
    } catch (error) {
      console.error('保存偏好设置失败:', error)
      toast.error('保存偏好设置失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">加载中...</span>
        </CardContent>
      </Card>
    )
  }

  if (!preferences) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">无法加载偏好设置</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 外观设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Palette className="h-5 w-5" />
            <span>外观设置</span>
          </CardTitle>
          <CardDescription>
            自定义界面外观和显示偏好
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>主题模式</Label>
              <p className="text-sm text-muted-foreground">
                选择浅色、深色或跟随系统设置
              </p>
            </div>
            <Select
              value={preferences.theme}
              onValueChange={(value: 'light' | 'dark' | 'system') => 
                updatePreference('theme', value)
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">浅色</SelectItem>
                <SelectItem value="dark">深色</SelectItem>
                <SelectItem value="system">跟随系统</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 货币设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>货币设置</span>
          </CardTitle>
          <CardDescription>
            设置默认货币和汇率显示
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>默认货币</Label>
              <p className="text-sm text-muted-foreground">
                用于显示价格和统计信息
              </p>
            </div>
            <Select
              value={preferences.currency}
              onValueChange={(value) => updatePreference('currency', value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <SelectItem key={currency.value} value={currency.value}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 通知设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>通知设置</span>
          </CardTitle>
          <CardDescription>
            管理您希望接收的通知类型
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>邮件通知</Label>
              <p className="text-sm text-muted-foreground">
                接收重要更新和系统通知
              </p>
            </div>
            <Switch
              checked={preferences.notifications.email}
              onCheckedChange={(checked) => 
                updateNestedPreference('notifications', 'email', checked)
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>推送通知</Label>
              <p className="text-sm text-muted-foreground">
                浏览器推送通知
              </p>
            </div>
            <Switch
              checked={preferences.notifications.push}
              onCheckedChange={(checked) => 
                updateNestedPreference('notifications', 'push', checked)
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>续费提醒</Label>
              <p className="text-sm text-muted-foreground">
                订阅即将到期时提醒
              </p>
            </div>
            <Switch
              checked={preferences.notifications.renewal_reminders}
              onCheckedChange={(checked) => 
                updateNestedPreference('notifications', 'renewal_reminders', checked)
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>支付确认</Label>
              <p className="text-sm text-muted-foreground">
                支付成功或失败通知
              </p>
            </div>
            <Switch
              checked={preferences.notifications.payment_confirmations}
              onCheckedChange={(checked) => 
                updateNestedPreference('notifications', 'payment_confirmations', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 隐私设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>隐私设置</span>
          </CardTitle>
          <CardDescription>
            控制您的数据和隐私偏好
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>个人资料可见性</Label>
              <p className="text-sm text-muted-foreground">
                控制其他用户是否可以查看您的个人资料
              </p>
            </div>
            <Select
              value={preferences.privacy.profile_visibility}
              onValueChange={(value: 'public' | 'private') => 
                updateNestedPreference('privacy', 'profile_visibility', value)
              }
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">公开</SelectItem>
                <SelectItem value="private">私密</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>数据共享</Label>
              <p className="text-sm text-muted-foreground">
                允许匿名数据用于产品改进
              </p>
            </div>
            <Switch
              checked={preferences.privacy.data_sharing}
              onCheckedChange={(checked) => 
                updateNestedPreference('privacy', 'data_sharing', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="min-w-[120px]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              保存偏好设置
            </>
          )}
        </Button>
      </div>
    </div>
  )
}