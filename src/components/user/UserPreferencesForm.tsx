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

// Supported currency list
const SUPPORTED_CURRENCIES = [
  { value: 'CNY', label: 'Chinese Yuan (¥)', symbol: '¥' },
  { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'British Pound (£)', symbol: '£' },
  { value: 'JPY', label: 'Japanese Yen (¥)', symbol: '¥' },
  { value: 'KRW', label: 'Korean Won (₩)', symbol: '₩' },
  { value: 'HKD', label: 'Hong Kong Dollar (HK$)', symbol: 'HK$' },
  { value: 'SGD', label: 'Singapore Dollar (S$)', symbol: 'S$' },
  { value: 'AUD', label: 'Australian Dollar (A$)', symbol: 'A$' },
  { value: 'CAD', label: 'Canadian Dollar (C$)', symbol: 'C$' }
] as const

export function UserPreferencesForm({ user, onPreferencesUpdate }: UserPreferencesFormProps) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load user preferences
  useEffect(() => {
    loadUserPreferences()
  }, [user.id])

  const loadUserPreferences = async () => {
    try {
      setLoading(true)
      const userPreferences = await UserProfileService.getUserPreferences(user.id)
      setPreferences(userPreferences)
    } catch (error) {
      console.error('Failed to load user preferences:', error)
      toast.error('Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }

  // Update top-level preference
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

  // Update nested preference
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

  // Save preferences
  const handleSave = async () => {
    if (!preferences) return

    try {
      setSaving(true)
      // 分拆写入：与 DB 表结构对齐，避免写入聚合键
      // 将 UI 的 payment_confirmations 映射为 DB 的 payment_notifications；保留 push 字段
      const notificationsOut = {
        email: preferences.notifications.email,
        renewal_reminders: preferences.notifications.renewal_reminders,
        payment_notifications: preferences.notifications.payment_confirmations,
        push: preferences.notifications.push
      }

      // 单请求批量 upsert，避免并发导致的唯一键冲突
      await UserProfileService.setUserSettingsBulk([
        { key: 'theme', value: preferences.theme },
        { key: 'currency', value: preferences.currency },
        { key: 'notifications', value: notificationsOut }
      ], user.id)

      // 本地状态即为最新，无需等待回读
      toast.success('Preferences saved')
      onPreferencesUpdate?.(preferences)
    } catch (error) {
      console.error('Failed to save preferences:', error)
      toast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading...</span>
        </CardContent>
      </Card>
    )
  }

  if (!preferences) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Unable to load preferences</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Palette className="h-5 w-5" />
            <span>Appearance</span>
          </CardTitle>
          <CardDescription>
            Customize the interface appearance and display preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">Choose light, dark, or follow system</p>
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
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>     

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notifications</span>
          </CardTitle>
          <CardDescription>
            Manage the types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email notifications</Label>
              <p className="text-sm text-muted-foreground">Receive important updates and alerts</p>
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
              <Label>Push notifications</Label>
              <p className="text-sm text-muted-foreground">Browser push notifications</p>
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
              <Label>Renewal reminders</Label>
              <p className="text-sm text-muted-foreground">Notify when subscriptions are about to renew</p>
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
              <Label>Payment notifications</Label>
              <p className="text-sm text-muted-foreground">Notify on payment success or failure</p>
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

      {/**
       * 临时注释：隐藏 Privacy 卡片
       * 原因：需求调整/待后端字段与权限策略确定，先下线该部分 UI，避免产生无效写入。
       * 注意：恢复时请同步核对 `preferences.privacy` 的数据结构与保存逻辑。
       */}
      {false && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Privacy</span>
            </CardTitle>
            <CardDescription>
              Control your data and privacy preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Profile visibility</Label>
                <p className="text-sm text-muted-foreground">Control whether others can view your profile</p>
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
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Data sharing</Label>
                <p className="text-sm text-muted-foreground">Allow anonymous data to improve the product</p>
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
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="min-w-[120px]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save preferences
            </>
          )}
        </Button>
      </div>
    </div>
  )
}