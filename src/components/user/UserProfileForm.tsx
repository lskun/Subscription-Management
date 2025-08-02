import React, { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { Camera, Upload, X, Save, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'

import { UserProfileService } from '@/services/userProfileService'
import type { 
  UserProfile, 
  UpdateUserProfileData,
  SupportedTimezone,
  SupportedLanguage
} from '@/types/userProfile'
import { SUPPORTED_TIMEZONES, SUPPORTED_LANGUAGES } from '@/types/userProfile'

interface UserProfileFormProps {
  user: User
  onProfileUpdate?: (profile: UserProfile) => void
}

export function UserProfileForm({ user, onProfileUpdate }: UserProfileFormProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // 表单状态
  const [formData, setFormData] = useState<UpdateUserProfileData>({
    display_name: '',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN'
  })

  // 头像上传相关
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // 加载用户配置
  useEffect(() => {
    loadUserProfile()
  }, [user.id])

  const loadUserProfile = async () => {
    try {
      setLoading(true)
      const userProfile = await UserProfileService.getUserProfile(user.id)
      
      if (userProfile) {
        setProfile(userProfile)
        setFormData({
          display_name: userProfile.display_name || '',
          timezone: userProfile.timezone as SupportedTimezone,
          language: userProfile.language as SupportedLanguage
        })
      }
    } catch (error) {
      console.error('加载用户配置失败:', error)
      toast.error('加载用户配置失败')
    } finally {
      setLoading(false)
    }
  }

  // 处理表单输入变化
  const handleInputChange = (field: keyof UpdateUserProfileData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 处理头像文件选择
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }

    // 验证文件大小 (最大 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('图片文件大小不能超过 2MB')
      return
    }

    setAvatarFile(file)
    
    // 创建预览URL
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
  }

  // 清除头像选择
  const clearAvatarSelection = () => {
    setAvatarFile(null)
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(null)
    }
  }

  // 删除现有头像
  const handleDeleteAvatar = async () => {
    try {
      setUploading(true)
      await UserProfileService.deleteAvatar(user.id)
      
      // 重新加载配置
      await loadUserProfile()
      toast.success('头像已删除')
    } catch (error) {
      console.error('删除头像失败:', error)
      toast.error('删除头像失败')
    } finally {
      setUploading(false)
    }
  }

  // 保存配置
  const handleSave = async () => {
    try {
      setSaving(true)

      // 验证表单数据
      const errors = UserProfileService.validateProfileData(formData)
      if (errors.length > 0) {
        toast.error(errors[0])
        return
      }

      // 上传头像（如果有选择新头像）
      if (avatarFile) {
        setUploading(true)
        try {
          const avatarUrl = await UserProfileService.uploadAvatar(avatarFile, user.id)
          formData.avatar_url = avatarUrl
          clearAvatarSelection()
        } catch (error) {
          console.error('上传头像失败:', error)
          toast.error('上传头像失败')
          return
        } finally {
          setUploading(false)
        }
      }

      // 更新用户配置
      const updatedProfile = await UserProfileService.updateUserProfile(formData, user.id)
      setProfile(updatedProfile)
      
      toast.success('配置已保存')
      onProfileUpdate?.(updatedProfile)
    } catch (error) {
      console.error('保存配置失败:', error)
      toast.error('保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  // 获取显示的头像URL
  const getDisplayAvatarUrl = () => {
    if (avatarPreview) return avatarPreview
    return profile?.avatar_url || null
  }

  // 获取用户名首字母作为头像fallback
  const getAvatarFallback = () => {
    const displayName = formData.display_name || user.email || 'U'
    return displayName.charAt(0).toUpperCase()
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>个人资料</CardTitle>
        <CardDescription>
          管理您的个人信息和偏好设置
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 头像设置 */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={getDisplayAvatarUrl() || undefined} />
              <AvatarFallback className="text-lg">
                {getAvatarFallback()}
              </AvatarFallback>
            </Avatar>
            
            {/* 头像操作按钮 */}
            <div className="absolute -bottom-2 -right-2 flex space-x-1">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => document.getElementById('avatar-upload')?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
              </Button>
              
              {(profile?.avatar_url || avatarPreview) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={avatarPreview ? clearAvatarSelection : handleDeleteAvatar}
                  disabled={uploading}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="font-medium">头像</h3>
            <p className="text-sm text-muted-foreground">
              点击相机图标上传新头像，支持 JPG、PNG 格式，最大 2MB
            </p>
            
            {avatarFile && (
              <div className="mt-2 flex items-center space-x-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>已选择: {avatarFile.name}</span>
              </div>
            )}
          </div>
          
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* 显示名称 */}
        <div className="space-y-2">
          <Label htmlFor="display-name">显示名称</Label>
          <Input
            id="display-name"
            value={formData.display_name}
            onChange={(e) => handleInputChange('display_name', e.target.value)}
            placeholder="输入您的显示名称"
            maxLength={50}
          />
          <p className="text-sm text-muted-foreground">
            这是其他用户看到的您的名称
          </p>
        </div>

        {/* 时区设置 */}
        <div className="space-y-2">
          <Label htmlFor="timezone">时区</Label>
          <Select
            value={formData.timezone}
            onValueChange={(value) => handleInputChange('timezone', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择时区" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_TIMEZONES.map((timezone) => (
                <SelectItem key={timezone.value} value={timezone.value}>
                  {timezone.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            用于显示时间和日期
          </p>
        </div>

        {/* 语言设置 */}
        <div className="space-y-2">
          <Label htmlFor="language">语言</Label>
          <Select
            value={formData.language}
            onValueChange={(value) => handleInputChange('language', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择语言" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((language) => (
                <SelectItem key={language.value} value={language.value}>
                  {language.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            界面显示语言
          </p>
        </div>

        {/* 账户信息（只读） */}
        <div className="space-y-2">
          <Label>邮箱地址</Label>
          <Input
            value={user.email || ''}
            disabled
            className="bg-muted"
          />
          <p className="text-sm text-muted-foreground">
            邮箱地址不能修改，如需更改请联系客服
          </p>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving || uploading}
            className="min-w-[100px]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                保存配置
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}