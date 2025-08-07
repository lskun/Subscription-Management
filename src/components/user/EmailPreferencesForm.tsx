// Email preferences form component
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

// Email type configuration
const EMAIL_TYPE_CONFIG: Record<EmailType, {
  label: string
  description: string
  icon: string
  category: 'account' | 'subscription' | 'security' | 'system'
  defaultEnabled: boolean
}> = {
  welcome: {
    label: 'Welcome Email',
    description: 'Welcome email sent when new users register',
    icon: '👋',
    category: 'account',
    defaultEnabled: true
  },
  subscription_expiry: {
    label: 'Subscription Expiry Reminder',
    description: 'Reminder email sent when subscription is about to expire',
    icon: '⏰',
    category: 'subscription',
    defaultEnabled: true
  },
  payment_failed: {
    label: 'Payment Failed Notification',
    description: 'Notification email sent when payment fails',
    icon: '❌',
    category: 'subscription',
    defaultEnabled: true
  },
  payment_success: {
    label: 'Payment Success Confirmation',
    description: 'Confirmation email sent when payment succeeds',
    icon: '✅',
    category: 'subscription',
    defaultEnabled: true
  },
  quota_warning: {
    label: 'Quota Warning',
    description: 'Warning email sent when usage approaches limit',
    icon: '⚠️',
    category: 'account',
    defaultEnabled: true
  },
  security_alert: {
    label: 'Security Alert',
    description: 'Warning email sent when security issues are detected',
    icon: '🔒',
    category: 'security',
    defaultEnabled: true
  },
  system_update: {
    label: 'System Update Notification',
    description: 'Notification email sent when system has important updates',
    icon: '🚀',
    category: 'system',
    defaultEnabled: false
  },
  password_reset: {
    label: 'Password Reset',
    description: 'Email sent when password reset is requested',
    icon: '🔑',
    category: 'security',
    defaultEnabled: true
  }
}

// Category configuration
const CATEGORY_CONFIG = {
  account: { label: 'Account Related', color: 'blue' },
  subscription: { label: 'Subscription Management', color: 'green' },
  security: { label: 'Security Alerts', color: 'red' },
  system: { label: 'System Notifications', color: 'gray' }
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

  // Load email preferences
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
      console.error('Failed to load email preferences:', error)
      toast({
        title: 'Loading Failed',
        description: 'Unable to load email preferences, please refresh the page and try again',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // Get preference for specific type
  const getPreference = (emailType: EmailType): EmailPreference | undefined => {
    return preferences.find(p => p.email_type === emailType)
  }

  // Update preference
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
        // Create new preference
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

  // Save preferences
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
        title: 'Save Successful',
        description: 'Email preferences have been updated'
      })
    } catch (error) {
      console.error('Failed to save email preferences:', error)
      toast({
        title: 'Save Failed',
        description: 'Unable to save email preferences, please try again',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  // Reset preferences
  const resetPreferences = () => {
    loadEmailPreferences()
    setHasChanges(false)
  }

  // Group email types by category
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
          <CardTitle>Email Notification Preferences</CardTitle>
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
          📧 Email Notification Preferences
        </CardTitle>
        <CardDescription>
          Manage the types and frequency of email notifications you wish to receive
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
                {emailTypes.length} items
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
                              Optional
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
                            <SelectItem value="immediate">Send Immediately</SelectItem>
                            <SelectItem value="daily">Daily Summary</SelectItem>
                            <SelectItem value="weekly">Weekly Summary</SelectItem>
                            <SelectItem value="never">Never Send</SelectItem>
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

export default EmailPreferencesForm