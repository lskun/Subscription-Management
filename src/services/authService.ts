import { supabase } from '@/lib/supabase'
import type { User, Session, AuthError } from '@supabase/supabase-js'

export interface AuthUser extends User {
  // 扩展用户信息
}

export interface AuthSession extends Session {
  // 扩展会话信息
}

export class AuthService {
  // 登录失败锁定相关常量
  private static readonly MAX_LOGIN_ATTEMPTS = 3
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000 // 15分钟

  /**
   * 检查账户是否被锁定
   */
  private static isAccountLocked(email: string): boolean {
    const lockoutKey = `lockout_${email}`
    const lockoutData = localStorage.getItem(lockoutKey)
    
    if (!lockoutData) return false
    
    try {
      const { lockedUntil } = JSON.parse(lockoutData)
      return Date.now() < lockedUntil
    } catch {
      // 如果数据格式错误，清除并返回未锁定
      localStorage.removeItem(lockoutKey)
      return false
    }
  }

  /**
   * 记录登录失败
   */
  private static recordLoginFailure(email: string): void {
    const attemptsKey = `login_attempts_${email}`
    const lockoutKey = `lockout_${email}`
    
    // 获取当前失败次数
    const attemptsData = localStorage.getItem(attemptsKey)
    let attempts = 0
    let firstAttemptTime = Date.now()
    
    if (attemptsData) {
      try {
        const parsed = JSON.parse(attemptsData)
        attempts = parsed.attempts || 0
        firstAttemptTime = parsed.firstAttemptTime || Date.now()
        
        // 如果第一次尝试超过1小时，重置计数
        if (Date.now() - firstAttemptTime > 60 * 60 * 1000) {
          attempts = 0
          firstAttemptTime = Date.now()
        }
      } catch {
        // 数据格式错误，重置
        attempts = 0
        firstAttemptTime = Date.now()
      }
    }
    
    attempts++
    
    // 保存失败次数
    localStorage.setItem(attemptsKey, JSON.stringify({
      attempts,
      firstAttemptTime,
      lastAttemptTime: Date.now()
    }))
    
    // 如果达到最大尝试次数，锁定账户
    if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = Date.now() + this.LOCKOUT_DURATION
      localStorage.setItem(lockoutKey, JSON.stringify({
        lockedUntil,
        attempts
      }))
      
      // 清除尝试记录
      localStorage.removeItem(attemptsKey)
      
      console.warn(`账户 ${email} 因连续登录失败被锁定至 ${new Date(lockedUntil).toLocaleString()}`)
    }
  }

  /**
   * 清除登录失败记录
   */
  private static clearLoginFailures(email: string): void {
    const attemptsKey = `login_attempts_${email}`
    const lockoutKey = `lockout_${email}`
    
    localStorage.removeItem(attemptsKey)
    localStorage.removeItem(lockoutKey)
  }

  /**
   * 获取剩余锁定时间
   */
  static getRemainingLockoutTime(email: string): number {
    const lockoutKey = `lockout_${email}`
    const lockoutData = localStorage.getItem(lockoutKey)
    
    if (!lockoutData) return 0
    
    try {
      const { lockedUntil } = JSON.parse(lockoutData)
      return Math.max(0, lockedUntil - Date.now())
    } catch {
      localStorage.removeItem(lockoutKey)
      return 0
    }
  }

  /**
   * 使用Google OAuth登录
   */
  static async signInWithGoogle(): Promise<{ data: any; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      })
      
      return { data, error }
    } catch (error) {
      console.error('Google登录失败:', error)
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * 使用邮箱和密码登录
   */
  static async signInWithEmail(email: string, password: string): Promise<{ data: any; error: AuthError | null }> {
    try {
      // 检查账户是否被锁定
      if (this.isAccountLocked(email)) {
        const remainingTime = this.getRemainingLockoutTime(email)
        const minutes = Math.ceil(remainingTime / (60 * 1000))
        
        const lockoutError = new Error(`账户已被锁定，请在 ${minutes} 分钟后重试`) as AuthError
        lockoutError.name = 'AuthError'
        lockoutError.code = 'account_locked'
        lockoutError.status = 429
        
        return { data: null, error: lockoutError }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        // 如果是认证错误（密码错误等），记录失败
        if (error.message?.includes('Invalid login credentials') || 
            error.message?.includes('Email not confirmed') ||
            error.code === 'invalid_credentials') {
          this.recordLoginFailure(email)
        }
        return { data, error }
      }
      
      // 登录成功，清除失败记录
      if (data?.user) {
        this.clearLoginFailures(email)
      }
      
      return { data, error }
    } catch (error) {
      console.error('邮箱登录失败:', error)
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * 用户注册
   */
  static async signUp(email: string, password: string, metadata?: Record<string, any>): Promise<{ data: any; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      })
      
      return { data, error }
    } catch (error) {
      console.error('用户注册失败:', error)
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * 发送密码重置邮件
   */
  static async resetPassword(email: string): Promise<{ data: any; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      
      return { data, error }
    } catch (error) {
      console.error('密码重置失败:', error)
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * 更新密码
   */
  static async updatePassword(password: string): Promise<{ data: any; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password
      })
      
      return { data, error }
    } catch (error) {
      console.error('密码更新失败:', error)
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * 登出
   */
  static async signOut(): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      console.error('登出失败:', error)
      return { error: error as AuthError }
    }
  }

  /**
   * 获取当前用户
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    } catch (error) {
      console.error('获取用户信息失败:', error)
      return null
    }
  }

  /**
   * 获取当前会话
   */
  static async getCurrentSession(): Promise<Session | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return session
    } catch (error) {
      console.error('获取会话信息失败:', error)
      return null
    }
  }

  /**
   * 监听认证状态变化
   */
  static onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }

  /**
   * 更新用户资料
   */
  static async updateProfile(updates: {
    email?: string
    password?: string
    data?: Record<string, any>
  }): Promise<{ data: any; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.updateUser(updates)
      return { data, error }
    } catch (error) {
      console.error('更新用户资料失败:', error)
      return { data: null, error: error as AuthError }
    }
  }
}