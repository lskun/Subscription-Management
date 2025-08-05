import { useState, useEffect, useRef } from 'react'
import { UserProfileService } from '@/services/userProfileService'
import { useAuth } from '@/contexts/AuthContext'
import { useSettingsStore } from '@/store/settingsStore'

/**
 * 用户头像 Hook
 * 使用 settingsStore 的统一缓存机制，避免重复请求
 */
export function useUserAvatar() {
  const { user } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    
    if (!user) {
      setAvatarUrl(null)
      setIsLoading(false)
      setError(null)
      return
    }

    const loadAvatar = async () => {
      try {
        if (mountedRef.current) {
          setIsLoading(true)
          setError(null)
        }
        
        console.log('🖼️ 开始加载用户头像:', user.id)
        const url = await UserProfileService.getUserAvatarUrl(user.id)
        
        if (mountedRef.current) {
          setAvatarUrl(url)
          console.log('✅ 用户头像加载完成:', user.id, url ? '有头像' : '无头像')
        }
      } catch (err) {
        console.error('❌ 加载用户头像失败:', err)
        
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : '加载头像失败')
          setAvatarUrl(null)
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false)
        }
      }
    }

    loadAvatar()
    
    return () => {
      mountedRef.current = false
    }
  }, [user])

  return {
    avatarUrl,
    isLoading,
    error,
    refetch: async () => {
      if (user) {
        const userId = user.id
        // 清除 settingsStore 中的头像缓存
        const avatarCacheKey = useSettingsStore.getState().generateCacheKey('userAvatar', userId)
        useSettingsStore.getState().clearGlobalCache(avatarCacheKey)
        
        setIsLoading(true)
        try {
          console.log('🔄 强制刷新用户头像:', userId)
          const url = await UserProfileService.getUserAvatarUrl(userId)
          
          if (mountedRef.current) {
            setAvatarUrl(url)
            setError(null)
            console.log('✅ 用户头像刷新完成:', userId, url ? '有头像' : '无头像')
          }
        } catch (err) {
          console.error('❌ 刷新用户头像失败:', err)
          if (mountedRef.current) {
            setError(err instanceof Error ? err.message : '刷新头像失败')
            setAvatarUrl(null)
          }
        } finally {
          if (mountedRef.current) {
            setIsLoading(false)
          }
        }
      }
    }
  }
}