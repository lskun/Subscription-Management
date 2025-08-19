import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { AuthService } from '@/services/authService'
import { SessionService, SessionState } from '@/services/sessionService'
import { UserInitializationService } from '@/services/userInitializationService'
import { useSettingsStore } from '@/store/settingsStore'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isSessionValid: boolean
  lastActivity: number
  expiresAt: number | null
  timeUntilExpiry: number | null
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<{ data: any; error: any } | undefined>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateProfile: (updates: { email?: string; password?: string; data?: Record<string, any> }) => Promise<void>
  refreshSession: () => Promise<boolean>
  validateSession: () => Promise<boolean>
  forceRefresh: () => Promise<boolean>
  getSessionInfo: () => { isActive: boolean; expiresAt: number | null; timeUntilExpiry: number | null; lastActivity: number }
  getDetailedSessionInfo: () => Promise<{ isActive: boolean; expiresAt: number | null; timeUntilExpiry: number | null; lastActivity: number; isValid: boolean; needsRefresh: boolean }>
  checkSessionHealth: () => Promise<{ isHealthy: boolean; issues: string[]; recommendations: string[] }>
  recoverSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [initializingUsers, setInitializingUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    let sessionUnsubscribe: (() => void) | null = null

    // 获取初始会话状态
    const initializeSession = async () => {
      try {
        console.log('开始初始化会话状态...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('获取会话失败:', error)
          setSession(null)
          setUser(null)
          setLoading(false)
          return
        }

        console.log('获取到会话:', session?.user?.email || '无会话')
        
        // 立即更新状态
        setSession(session)
        setUser(session?.user ?? null)
        
        // 如果有有效会话，启动会话管理
        if (session) {
          SessionService.startSessionManagement()
          console.log('会话管理已启动，用户:', session.user.email)
        }
        
        setLoading(false)
      } catch (error) {
        console.error('初始化会话失败:', error)
        setSession(null)
        setUser(null)
        setLoading(false)
      }
    }

    // 监听认证状态变化
    const { data: { subscription } } = AuthService.onAuthStateChange(
      async (event, session) => {
        console.log('认证状态变化:', event, session?.user?.email || '无用户')
        
        // 立即更新基础状态
        setSession(session)
        setUser(session?.user ?? null)
        
        // 更新用户缓存
        useSettingsStore.getState().updateUserCache(session?.user ?? null)
        
        // 处理特定事件
        switch (event) {
          case 'SIGNED_IN':
            console.log('用户已登录:', session?.user?.email)
            setLoading(false)
            SessionService.startSessionManagement()
            
            // 用户登录后异步加载汇率到settingsStore缓存
            setTimeout(async () => {
              try {
                console.log('🔄 用户登录成功，开始异步加载汇率到缓存...')
                const store = useSettingsStore.getState()
                await store.fetchExchangeRates()
                console.log('✅ 汇率数据已成功加载到settingsStore缓存')
              } catch (error) {
                console.error('⚠️ 汇率加载失败，将继续使用默认汇率:', error)
              }
            }, 800) // 800ms后开始加载汇率，给用户状态更新时间

            // 检查是否是新用户，如果是则初始化（防止重复初始化）
            if (session?.user && !initializingUsers.has(session.user.id)) {
              // 添加到正在初始化的用户集合
              setInitializingUsers(prev => new Set(prev).add(session.user.id))
              
              // 延迟初始化检查，让缓存有时间建立
              setTimeout(async () => {
                try {
                  // 首先预热缓存 - 更新用户缓存到 settingsStore
                  const store = useSettingsStore.getState()
                  store.updateUserCache(session.user)
                  
                  // 预设用户配置缓存，避免后续查询数据库
                  const userProfileCacheKey = store.generateCacheKey('user_profile', session.user.id)
                  console.log('🔍 [DEBUG] AuthContext: 预设用户配置缓存', { userId: session.user.id, cacheKey: userProfileCacheKey })
                  
                  // 设置完整的用户配置缓存，匹配 user_profiles 表结构
                  const userProfileCache = {
                    id: session.user.id,
                    display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || '用户',
                    avatar_url: session.user.user_metadata?.avatar_url || null,
                    timezone: session.user.user_metadata?.timezone || 'Asia/Shanghai',
                    language: session.user.user_metadata?.language || 'en-US',
                    created_at: session.user.created_at,
                    updated_at: new Date().toISOString(),
                    last_login_time: new Date().toISOString(),
                    is_blocked: false,
                    email: session.user.email
                  }
                  store.setGlobalCache(userProfileCacheKey, userProfileCache)
                  console.log('🔍 [DEBUG] AuthContext: 用户配置缓存已设置', { userId: session.user.id, cacheData: userProfileCache })
                  
                  // 延迟更长时间，让页面组件有机会建立缓存
                  await new Promise(resolve => setTimeout(resolve, 1000))

                  const isInitialized = await UserInitializationService.isUserInitialized(session.user.id)
                  if (!isInitialized) {
                    console.log('检测到新用户，开始初始化...')
                    const initResult = await UserInitializationService.initializeNewUser(session.user)
                    if (initResult.success) {
                      console.log('新用户初始化成功')
                      toast.success('Welcome to Subscription Manager!')
                    } else {
                      console.error('新用户初始化失败:', initResult.error)
                      toast.warning('Login successful, but initialization failed')
                    }
                  }
                } catch (error) {
                  console.error('检查用户初始化状态失败:', error)
                } finally {
                  // 从正在初始化的用户集合中移除
                  setInitializingUsers(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(session.user.id)
                    return newSet
                  })
                }
              }, 1500) // 增加延迟时间
            }
            break
          case 'SIGNED_OUT':
            console.log('用户已登出')
            setLoading(false)
            SessionService.stopSessionManagement()
            setSessionState(null)
            break
          case 'TOKEN_REFRESHED':
            console.log('Token已刷新')
            setLoading(false)
            break
          case 'USER_UPDATED':
            console.log('用户信息已更新')
            setLoading(false)
            break
          default:
            // 对于其他事件（如初始状态检查），确保loading状态被正确设置
            setLoading(false)
            break
        }

        // 更新会话状态
        const newState = session 
          ? {
              session,
              user: session.user,
              isAuthenticated: true,
              isLoading: false,
              lastActivity: Date.now(),
              expiresAt: session.expires_at ? session.expires_at * 1000 : null
            }
          : {
              session: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
              lastActivity: Date.now(),
              expiresAt: null
            }
        setSessionState(newState)
      }
    )

    // 监听会话状态变化
    sessionUnsubscribe = SessionService.addListener((state) => {
      setSessionState(state)
      setSession(state.session)
      setUser(state.user)
    })

    // 监听会话超时和过期事件
    const handleSessionTimeout = () => {
      toast.error('Session timed out, please log in again')
      // 可以在这里添加重定向到登录页面的逻辑
    }

    const handleSessionExpired = (event: CustomEvent) => {
      const { reason } = event.detail
      if (reason === 'token_refresh_failed') {
        toast.error('Session expired, please log in again')
      }
      // 可以在这里添加重定向到登录页面的逻辑
    }

    window.addEventListener('sessionTimeout', handleSessionTimeout)
    window.addEventListener('sessionExpired', handleSessionExpired as EventListener)

    // 统一 401 处理：来自 supabaseGateway 的全局未授权事件
    const handleAuthUnauthorized = async () => {
      try {
        toast.error('Your session has expired, please log in again')
        await SessionService.signOut('token_invalid')
      } finally {
        // 统一跳转登录页
        window.location.assign('/login')
      }
    }
    window.addEventListener('auth:unauthorized', handleAuthUnauthorized as EventListener)

    // 全局 403 处理：权限不足
    const handleAuthForbidden = async () => {
      toast.error('Permission denied')
    }
    window.addEventListener('auth:forbidden', handleAuthForbidden as EventListener)

    // 初始化
    initializeSession()

    return () => {
      subscription.unsubscribe()
      if (sessionUnsubscribe) {
        sessionUnsubscribe()
      }
      SessionService.stopSessionManagement()
      window.removeEventListener('sessionTimeout', handleSessionTimeout)
      window.removeEventListener('sessionExpired', handleSessionExpired as EventListener)
      window.removeEventListener('auth:unauthorized', handleAuthUnauthorized as EventListener)
      window.removeEventListener('auth:forbidden', handleAuthForbidden as EventListener)
    }
  }, [])

  const signInWithGoogle = async () => {
    try {
      setLoading(true)
      const { error } = await AuthService.signInWithGoogle()
      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Google登录失败:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { error } = await AuthService.signInWithEmail(email, password)
      if (error) {
        throw error
      }
    } catch (error) {
      console.error('邮箱登录失败:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
    try {
      setLoading(true)
      const { data, error } = await AuthService.signUp(email, password, metadata)
      if (error) {
        throw error
      }
      
      // 如果注册成功且有用户数据和会话，说明用户已自动登录
      if (data?.user && data?.session) {
        console.log('注册成功，用户已自动登录:', data.user.email)
        
        // 立即更新认证状态
        setSession(data.session)
        setUser(data.user)
        
        // 启动会话管理
        SessionService.startSessionManagement()
        
        // 防止重复初始化
        if (!initializingUsers.has(data.user.id)) {
          setInitializingUsers(prev => new Set(prev).add(data.user.id))
          
          try {
            const initResult = await UserInitializationService.initializeNewUser(data.user)
            
            if (initResult.success) {
              console.log('用户初始化成功:', initResult.message)
            } else {
              console.error('用户初始化失败:', initResult.error)
              toast.warning('Registration successful, but initialization failed')
            }
          } catch (initError) {
            console.error('用户初始化异常:', initError)
            toast.warning('Registration successful, but initialization failed')
          } finally {
            setInitializingUsers(prev => {
              const newSet = new Set(prev)
              newSet.delete(data.user.id)
              return newSet
            })
          }
        }
      } else if (data?.user && !data?.session) {
        // 如果只有用户数据但没有会话，说明需要邮箱验证
        console.log('注册成功，需要邮箱验证:', data.user.email)
      }
      
      // 返回结果给调用者
      return { data, error }
    } catch (error) {
      console.error('用户注册失败:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      
      // 清除用户相关的所有缓存
      useSettingsStore.getState().clearUserCache()
      // 清除订阅数据缓存
      const { subscriptionsEdgeFunctionService } = await import('@/services/subscriptionsEdgeFunctionService')
      subscriptionsEdgeFunctionService.clearCache()
      
      // 清除仪表板分析缓存
      const { dashboardAnalyticsService } = await import('@/services/dashboardAnalyticsService')
      dashboardAnalyticsService.clearCache()
      
      // 使用SessionService的安全登出
      await SessionService.signOut('user_initiated')
    } catch (error) {
      console.error('登出失败:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await AuthService.resetPassword(email)
      if (error) {
        throw error
      }
    } catch (error) {
      console.error('密码重置失败:', error)
      throw error
    }
  }

  const updatePassword = async (password: string) => {
    try {
      const { error } = await AuthService.updatePassword(password)
      if (error) {
        throw error
      }
    } catch (error) {
      console.error('密码更新失败:', error)
      throw error
    }
  }

  const updateProfile = async (updates: { email?: string; password?: string; data?: Record<string, any> }) => {
    try {
      const { error } = await AuthService.updateProfile(updates)
      if (error) {
        throw error
      }
    } catch (error) {
      console.error('更新用户资料失败:', error)
      throw error
    }
  }

  // 会话管理相关方法
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      return await SessionService.forceRefresh()
    } catch (error) {
      console.error('刷新会话失败:', error)
      return false
    }
  }, [])

  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      return await SessionService.validateSession()
    } catch (error) {
      console.error('验证会话失败:', error)
      return false
    }
  }, [])

  const forceRefresh = useCallback(async (): Promise<boolean> => {
    try {
      return await SessionService.forceRefresh()
    } catch (error) {
      console.error('强制刷新失败:', error)
      return false
    }
  }, [])

  const getSessionInfo = useCallback(() => {
    return SessionService.getSessionInfo()
  }, [])

  const getDetailedSessionInfo = useCallback(async () => {
    return await SessionService.getDetailedSessionInfo()
  }, [])

  const checkSessionHealth = useCallback(async () => {
    return await SessionService.checkSessionHealth()
  }, [])

  const recoverSession = useCallback(async () => {
    return await SessionService.recoverSessionManagement()
  }, [])

  // 计算会话相关信息
  const isSessionValid = sessionState?.isAuthenticated && sessionState?.session !== null
  const lastActivity = sessionState?.lastActivity || 0
  const expiresAt = sessionState?.expiresAt || null
  const timeUntilExpiry = expiresAt ? Math.max(0, expiresAt - Date.now()) : null

  const value: AuthContextType = {
    user,
    session,
    loading,
    isSessionValid,
    lastActivity,
    expiresAt,
    timeUntilExpiry,
    signInWithGoogle,
    signInWithEmail,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshSession,
    validateSession,
    forceRefresh,
    getSessionInfo,
    getDetailedSessionInfo,
    checkSessionHealth,
    recoverSession,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}