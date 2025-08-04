import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { AuthService } from '@/services/authService'
import { SessionService, SessionState } from '@/services/sessionService'
import { UserInitializationService } from '@/services/userInitializationService'
import { UserCacheService } from '@/services/userCacheService'
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
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<void>
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
        UserCacheService.updateCache(session?.user ?? null)
        
        // 处理特定事件
        switch (event) {
          case 'SIGNED_IN':
            console.log('用户已登录:', session?.user?.email)
            setLoading(false)
            SessionService.startSessionManagement()
            
            // 检查是否是新用户，如果是则初始化（防止重复初始化）
            if (session?.user && !initializingUsers.has(session.user.id)) {
              // 添加到正在初始化的用户集合
              setInitializingUsers(prev => new Set(prev).add(session.user.id))
              
              // 添加小延迟确保认证状态完全同步
              setTimeout(async () => {
                try {
                  const isInitialized = await UserInitializationService.isUserInitialized(session.user.id)
                  if (!isInitialized) {
                    console.log('检测到新用户，开始初始化...')
                    const initResult = await UserInitializationService.initializeNewUser(session.user)
                    if (initResult.success) {
                      console.log('新用户初始化成功')
                      toast.success('欢迎使用订阅管理器！')
                    } else {
                      console.error('新用户初始化失败:', initResult.error)
                      toast.warning('登录成功，但初始化过程中出现问题')
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
              }, 500)
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
      toast.error('会话已超时，请重新登录')
      // 可以在这里添加重定向到登录页面的逻辑
    }

    const handleSessionExpired = (event: CustomEvent) => {
      const { reason } = event.detail
      if (reason === 'token_refresh_failed') {
        toast.error('会话已过期，请重新登录')
      }
      // 可以在这里添加重定向到登录页面的逻辑
    }

    window.addEventListener('sessionTimeout', handleSessionTimeout)
    window.addEventListener('sessionExpired', handleSessionExpired as EventListener)

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
      
      // 如果注册成功且有用户数据，调用初始化函数（防止重复初始化）
      if (data?.user && !initializingUsers.has(data.user.id)) {
        setInitializingUsers(prev => new Set(prev).add(data.user.id))
        
        try {
          const initResult = await UserInitializationService.initializeNewUser(data.user)
          
          if (initResult.success) {
            console.log('用户初始化成功:', initResult.message)
            toast.success('注册成功！欢迎使用订阅管理器')
          } else {
            console.error('用户初始化失败:', initResult.error)
            toast.warning('注册成功，但初始化过程中出现问题，请联系客服')
          }
        } catch (initError) {
          console.error('用户初始化异常:', initError)
          toast.warning('注册成功，但初始化过程中出现问题，请联系客服')
        } finally {
          setInitializingUsers(prev => {
            const newSet = new Set(prev)
            newSet.delete(data.user.id)
            return newSet
          })
        }
      }
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
      // 清除用户缓存
      UserCacheService.clearCache()
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