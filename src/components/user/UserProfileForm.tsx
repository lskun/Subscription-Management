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
  
  // Form state
  const [formData, setFormData] = useState<UpdateUserProfileData>({
    display_name: '',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN'
  })

  // Avatar upload related
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Load user profile
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
      console.error('Failed to load user profile:', error)
      toast.error('Failed to load user profile')
    } finally {
      setLoading(false)
    }
  }

  // Handle form input changes
  const handleInputChange = (field: keyof UpdateUserProfileData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Handle avatar file selection
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image file size cannot exceed 2MB')
      return
    }

    setAvatarFile(file)
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
  }

  // Clear avatar selection
  const clearAvatarSelection = () => {
    setAvatarFile(null)
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(null)
    }
  }

  // Delete existing avatar
  const handleDeleteAvatar = async () => {
    try {
      setUploading(true)
      await UserProfileService.deleteAvatar(user.id)
      
      // Reload profile
      await loadUserProfile()
      toast.success('Avatar deleted')
    } catch (error) {
      console.error('Failed to delete avatar:', error)
      toast.error('Failed to delete avatar')
    } finally {
      setUploading(false)
    }
  }

  // Save profile
  const handleSave = async () => {
    try {
      setSaving(true)

      // Validate form data
      const errors = UserProfileService.validateProfileData(formData)
      if (errors.length > 0) {
        toast.error(errors[0])
        return
      }

      // Upload avatar (if new avatar is selected)
      if (avatarFile) {
        setUploading(true)
        try {
          const avatarUrl = await UserProfileService.uploadAvatar(avatarFile, user.id)
          formData.avatar_url = avatarUrl
          clearAvatarSelection()
        } catch (error) {
          console.error('Failed to upload avatar:', error)
          toast.error('Failed to upload avatar')
          return
        } finally {
          setUploading(false)
        }
      }

      // Update user profile
      const updatedProfile = await UserProfileService.updateUserProfile(formData, user.id)
      setProfile(updatedProfile)
      
      toast.success('Profile saved')
      onProfileUpdate?.(updatedProfile)
    } catch (error) {
      console.error('Failed to save profile:', error)
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  // Get display avatar URL
  const getDisplayAvatarUrl = () => {
    if (avatarPreview) return avatarPreview
    return profile?.avatar_url || null
  }

  // Get user name initial as avatar fallback
  const getAvatarFallback = () => {
    const displayName = formData.display_name || user.email || 'U'
    return displayName.charAt(0).toUpperCase()
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Profile</CardTitle>
        <CardDescription>
          Manage your personal information and preference settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar settings */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={getDisplayAvatarUrl() || undefined} />
              <AvatarFallback className="text-lg">
                {getAvatarFallback()}
              </AvatarFallback>
            </Avatar>
            
            {/* Avatar action buttons */}
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
            <h3 className="font-medium">Avatar</h3>
            <p className="text-sm text-muted-foreground">
              Click the camera icon to upload a new avatar, supports JPG, PNG formats, maximum 2MB
            </p>
            
            {avatarFile && (
              <div className="mt-2 flex items-center space-x-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>Selected: {avatarFile.name}</span>
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

        {/* Display name */}
        <div className="space-y-2">
          <Label htmlFor="display-name">Display Name</Label>
          <Input
            id="display-name"
            value={formData.display_name}
            onChange={(e) => handleInputChange('display_name', e.target.value)}
            placeholder="Enter your display name"
            maxLength={50}
          />
          <p className="text-sm text-muted-foreground">
            This is the name other users will see
          </p>
        </div>

        {/* Timezone settings */}
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select
            value={formData.timezone}
            onValueChange={(value) => handleInputChange('timezone', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select timezone" />
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
            Used for displaying time and dates
          </p>
        </div>

        {/* Language settings */}
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select
            value={formData.language}
            onValueChange={(value) => handleInputChange('language', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
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
            Interface display language
          </p>
        </div>

        {/* Account information (read-only) */}
        <div className="space-y-2">
          <Label>Email Address</Label>
          <Input
            value={user.email || ''}
            disabled
            className="bg-muted"
          />
          <p className="text-sm text-muted-foreground">
            Email address cannot be modified, please contact customer service if you need to change it
          </p>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving || uploading}
            className="min-w-[100px]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Profile
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}