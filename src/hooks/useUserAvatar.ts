import { useState, useEffect, useRef } from 'react'
import { UserProfileService } from '@/services/userProfileService'
import { useAuth } from '@/contexts/AuthContext'

// 全局缓存，避免多个组件实例重复请求
const avatarCache = new Map<string, {
  url: string | null
  timestamp: number
  loading: boolean
}>()

const CACHE_DURATION = 30000 // 30秒缓存
const activeRequests = new Map<string, Promise<string | null>>()

/**
 * 用户头像 Hook
 * 自动处理 Google 头像缓存，避免重复请求
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
      return
    }

    const userId = user.id
    const now = Date.now()
    const cached = avatarCache.get(userId)
    
    // 检查缓存是否有效
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      setAvatarUrl(cached.url)
      setIsLoading(cached.loading)
      return
    }

    const loadAvatar = async () => {
      try {
        // 检查是否已有进行中的请求
        let existingRequest = activeRequests.get(userId)
        if (existingRequest) {
          console.log('等待现有的头像请求...')
          const url = await existingRequest
          if (mountedRef.current) {
            setAvatarUrl(url)
            setIsLoading(false)
          }
          return
        }

        if (mountedRef.current) {
          setIsLoading(true)
          setError(null)
        }
        
        // 创建新的请求
        const request = UserProfileService.getUserAvatarUrl(userId)
        activeRequests.set(userId, request)
        
        // 更新缓存状态为加载中
        avatarCache.set(userId, {
          url: null,
          timestamp: now,
          loading: true
        })
        
        const url = await request
        
        // 更新缓存
        avatarCache.set(userId, {
          url,
          timestamp: Date.now(),
          loading: false
        })
        
        if (mountedRef.current) {
          setAvatarUrl(url)
        }
      } catch (err) {
        console.error('加载用户头像失败:', err)
        
        // 更新缓存状态
        avatarCache.set(userId, {
          url: null,
          timestamp: Date.now(),
          loading: false
        })
        
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : '加载头像失败')
          setAvatarUrl(null)
        }
      } finally {
        activeRequests.delete(userId)
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
        // 清除缓存，强制重新获取
        avatarCache.delete(userId)
        activeRequests.delete(userId)
        
        setIsLoading(true)
        try {
          const url = await UserProfileService.getUserAvatarUrl(userId)
          
          // 更新缓存
          avatarCache.set(userId, {
            url,
            timestamp: Date.now(),
            loading: false
          })
          
          if (mountedRef.current) {
            setAvatarUrl(url)
            setError(null)
          }
        } catch (err) {
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