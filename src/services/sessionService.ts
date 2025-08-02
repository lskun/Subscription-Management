import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

export interface SessionState {
  session: Session | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  lastActivity: number
  expiresAt: number | null
}

export class SessionService {
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000 // 30分钟无活动自动登出
  private static readonly REFRESH_THRESHOLD = 5 * 60 * 1000 // token过期前5分钟刷新
  private static activityTimer: NodeJS.Timeout | null = null
  private static refreshTimer: NodeJS.Timeout | null = null
  private static listeners: Array<(state: SessionState) => void> = []

  /**
   * 获取当前会话状态
   */
  static async getCurrentSessionState(): Promise<SessionState> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('获取会话失败:', error)
        return this.createEmptySessionState()
      }

      return this.createSessionState(session)
    } catch (error) {
      console.error('获取会话状态失败:', error)
      return this.createEmptySessionState()
    }
  }

  /**
   * 创建会话状态对象
   */
  private static createSessionState(session: Session | null): SessionState {
    const now = Date.now()
    return {
      session,
      user: session?.user || null,
      isAuthenticated: !!session,
      isLoading: false,
      lastActivity: now,
      expiresAt: session?.expires_at ? session.expires_at * 1000 : null
    }
  }

  /**
   * 创建空会话状态
   */
  private static createEmptySessionState(): SessionState {
    return {
      session: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      lastActivity: Date.now(),
      expiresAt: null
    }
  }

  /**
   * 启动会话管理
   */
  static startSessionManagement(): void {
    this.setupActivityTracking()
    this.setupTokenRefresh()
    this.setupStorageListener()
  }

  /**
   * 停止会话管理
   */
  static stopSessionManagement(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer)
      this.activityTimer = null
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    this.removeActivityListeners()
  }

  /**
   * 设置用户活动跟踪
   */
  private static setupActivityTracking(): void {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const updateActivity = () => {
      this.updateLastActivity()
    }

    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })

    // 定期检查会话超时
    this.checkSessionTimeout()
  }

  /**
   * 移除活动监听器
   */
  private static removeActivityListeners(): void {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const updateActivity = () => {
      this.updateLastActivity()
    }

    events.forEach(event => {
      document.removeEventListener(event, updateActivity)
    })
  }

  /**
   * 更新最后活动时间
   */
  private static updateLastActivity(): void {
    const now = Date.now()
    localStorage.setItem('lastActivity', now.toString())
    
    // 重置超时检查
    if (this.activityTimer) {
      clearTimeout(this.activityTimer)
    }
    this.checkSessionTimeout()
  }

  /**
   * 检查会话超时
   */
  private static checkSessionTimeout(): void {
    this.activityTimer = setTimeout(async () => {
      const lastActivity = parseInt(localStorage.getItem('lastActivity') || '0')
      const now = Date.now()
      
      if (now - lastActivity >= this.SESSION_TIMEOUT) {
        console.log('会话因无活动而超时')
        await this.handleSessionTimeout()
      } else {
        // 继续检查
        this.checkSessionTimeout()
      }
    }, this.SESSION_TIMEOUT)
  }

  /**
   * 处理会话超时
   */
  private static async handleSessionTimeout(): Promise<void> {
    try {
      await this.signOut('timeout')
      
      // 通知用户会话已超时
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('sessionTimeout', {
          detail: { reason: 'inactivity' }
        })
        window.dispatchEvent(event)
      }
    } catch (error) {
      console.error('处理会话超时失败:', error)
    }
  }

  /**
   * 设置token自动刷新
   */
  private static setupTokenRefresh(): void {
    this.scheduleTokenRefresh()
  }

  /**
   * 安排token刷新
   */
  private static async scheduleTokenRefresh(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.expires_at) {
        return
      }

      const expiresAt = session.expires_at * 1000
      const now = Date.now()
      const timeUntilRefresh = expiresAt - now - this.REFRESH_THRESHOLD

      if (timeUntilRefresh > 0) {
        this.refreshTimer = setTimeout(async () => {
          await this.refreshToken()
        }, timeUntilRefresh)
      } else {
        // token即将过期，立即刷新
        await this.refreshToken()
      }
    } catch (error) {
      console.error('安排token刷新失败:', error)
    }
  }

  /**
   * 刷新token
   */
  private static async refreshToken(): Promise<boolean> {
    try {
      console.log('正在刷新token...')
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error) {
        console.error('Token刷新失败:', error)
        await this.handleTokenRefreshFailure(error)
        return false
      }

      if (data.session) {
        console.log('Token刷新成功')
        // 安排下次刷新
        this.scheduleTokenRefresh()
        
        // 通知监听器
        this.notifyListeners(this.createSessionState(data.session))
        return true
      }

      return false
    } catch (error) {
      console.error('Token刷新异常:', error)
      await this.handleTokenRefreshFailure(error)
      return false
    }
  }

  /**
   * 处理token刷新失败
   */
  private static async handleTokenRefreshFailure(error: any): Promise<void> {
    console.error('Token刷新失败，需要重新登录:', error)
    
    // 清除会话
    await this.signOut('token_refresh_failed')
    
    // 通知用户需要重新登录
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('sessionExpired', {
        detail: { reason: 'token_refresh_failed', error }
      })
      window.dispatchEvent(event)
    }
  }

  /**
   * 设置存储监听器（多标签页同步）
   */
  private static setupStorageListener(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('storage', (e) => {
      if (e.key === 'supabase.auth.token') {
        // 其他标签页的认证状态发生变化
        this.handleStorageChange(e)
      }
    })
  }

  /**
   * 处理存储变化（多标签页同步）
   */
  private static async handleStorageChange(e: StorageEvent): Promise<void> {
    try {
      if (!e.newValue && e.oldValue) {
        // token被删除，用户在其他标签页登出
        console.log('检测到其他标签页登出')
        const state = this.createEmptySessionState()
        this.notifyListeners(state)
      } else if (e.newValue && !e.oldValue) {
        // 新token，用户在其他标签页登录
        console.log('检测到其他标签页登录')
        const state = await this.getCurrentSessionState()
        this.notifyListeners(state)
      }
    } catch (error) {
      console.error('处理存储变化失败:', error)
    }
  }

  /**
   * 安全登出
   */
  static async signOut(reason: string = 'user_initiated'): Promise<void> {
    try {
      console.log(`用户登出，原因: ${reason}`)
      
      // 清除定时器
      this.stopSessionManagement()
      
      // 清除本地存储
      localStorage.removeItem('lastActivity')
      
      // 调用Supabase登出
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Supabase登出失败:', error)
        // 即使Supabase登出失败，也要清除本地状态
      }
      
      // 通知监听器
      const state = this.createEmptySessionState()
      this.notifyListeners(state)
      
      console.log('登出完成')
    } catch (error) {
      console.error('登出过程中发生错误:', error)
      // 确保本地状态被清除
      const state = this.createEmptySessionState()
      this.notifyListeners(state)
    }
  }

  /**
   * 检查会话有效性
   */
  static async validateSession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        return false
      }

      // 检查token是否过期
      const now = Date.now()
      const expiresAt = session.expires_at * 1000
      
      if (now >= expiresAt) {
        console.log('Token已过期')
        return false
      }

      return true
    } catch (error) {
      console.error('验证会话失败:', error)
      return false
    }
  }

  /**
   * 添加会话状态监听器
   */
  static addListener(callback: (state: SessionState) => void): () => void {
    this.listeners.push(callback)
    
    // 返回取消监听的函数
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 通知所有监听器
   */
  private static notifyListeners(state: SessionState): void {
    this.listeners.forEach(callback => {
      try {
        callback(state)
      } catch (error) {
        console.error('会话状态监听器执行失败:', error)
      }
    })
  }

  /**
   * 获取会话信息
   */
  static getSessionInfo(): {
    isActive: boolean
    expiresAt: number | null
    timeUntilExpiry: number | null
    lastActivity: number
  } {
    const lastActivity = parseInt(localStorage.getItem('lastActivity') || '0')
    
    // 尝试从localStorage获取会话信息
    try {
      const sessionData = localStorage.getItem('supabase.auth.token')
      if (sessionData) {
        const parsed = JSON.parse(sessionData)
        const expiresAt = parsed.expires_at ? parsed.expires_at * 1000 : null
        const timeUntilExpiry = expiresAt ? Math.max(0, expiresAt - Date.now()) : null
        
        return {
          isActive: this.activityTimer !== null,
          expiresAt,
          timeUntilExpiry,
          lastActivity
        }
      }
    } catch (error) {
      console.error('解析会话信息失败:', error)
    }
    
    return {
      isActive: this.activityTimer !== null,
      expiresAt: null,
      timeUntilExpiry: null,
      lastActivity
    }
  }

  /**
   * 获取详细的会话信息（异步版本）
   */
  static async getDetailedSessionInfo(): Promise<{
    isActive: boolean
    expiresAt: number | null
    timeUntilExpiry: number | null
    lastActivity: number
    isValid: boolean
    needsRefresh: boolean
  }> {
    const lastActivity = parseInt(localStorage.getItem('lastActivity') || '0')
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const now = Date.now()
      const expiresAt = session?.expires_at ? session.expires_at * 1000 : null
      const timeUntilExpiry = expiresAt ? Math.max(0, expiresAt - now) : null
      const needsRefresh = expiresAt ? (expiresAt - now) <= this.REFRESH_THRESHOLD : false
      
      return {
        isActive: this.activityTimer !== null,
        expiresAt,
        timeUntilExpiry,
        lastActivity,
        isValid: !!session && (expiresAt ? now < expiresAt : true),
        needsRefresh
      }
    } catch (error) {
      console.error('获取详细会话信息失败:', error)
      return {
        isActive: this.activityTimer !== null,
        expiresAt: null,
        timeUntilExpiry: null,
        lastActivity,
        isValid: false,
        needsRefresh: false
      }
    }
  }

  /**
   * 强制刷新会话
   */
  static async forceRefresh(): Promise<boolean> {
    return await this.refreshToken()
  }

  /**
   * 检查是否需要刷新token
   */
  static async shouldRefreshToken(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.expires_at) {
        return false
      }

      const expiresAt = session.expires_at * 1000
      const now = Date.now()
      
      return (expiresAt - now) <= this.REFRESH_THRESHOLD
    } catch (error) {
      console.error('检查token刷新需求失败:', error)
      return false
    }
  }

  /**
   * 检查会话健康状态
   */
  static async checkSessionHealth(): Promise<{
    isHealthy: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // 检查会话存在性
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        issues.push('无有效会话')
        recommendations.push('请重新登录')
        return { isHealthy: false, issues, recommendations }
      }

      // 检查token过期时间
      const now = Date.now()
      const expiresAt = session.expires_at * 1000
      const timeUntilExpiry = expiresAt - now

      if (timeUntilExpiry <= 0) {
        issues.push('会话已过期')
        recommendations.push('请重新登录')
      } else if (timeUntilExpiry <= this.REFRESH_THRESHOLD) {
        issues.push('会话即将过期')
        recommendations.push('建议刷新会话')
      }

      // 检查用户活动
      const lastActivity = parseInt(localStorage.getItem('lastActivity') || '0')
      const timeSinceActivity = now - lastActivity
      
      if (timeSinceActivity >= this.SESSION_TIMEOUT) {
        issues.push('长时间无活动')
        recommendations.push('会话可能因无活动而超时')
      }

      // 检查会话管理状态
      if (!this.activityTimer) {
        issues.push('会话管理未启动')
        recommendations.push('重新启动会话管理')
      }

      return {
        isHealthy: issues.length === 0,
        issues,
        recommendations
      }
    } catch (error) {
      console.error('检查会话健康状态失败:', error)
      return {
        isHealthy: false,
        issues: ['会话健康检查失败'],
        recommendations: ['请刷新页面或重新登录']
      }
    }
  }

  /**
   * 恢复会话管理（用于错误恢复）
   */
  static async recoverSessionManagement(): Promise<boolean> {
    try {
      console.log('尝试恢复会话管理...')
      
      // 停止现有管理
      this.stopSessionManagement()
      
      // 检查会话有效性
      const isValid = await this.validateSession()
      if (!isValid) {
        console.log('会话无效，无法恢复')
        return false
      }
      
      // 重新启动会话管理
      this.startSessionManagement()
      
      console.log('会话管理恢复成功')
      return true
    } catch (error) {
      console.error('恢复会话管理失败:', error)
      return false
    }
  }

  /**
   * 清理会话数据（用于彻底清理）
   */
  static cleanupSessionData(): void {
    try {
      // 清理localStorage
      localStorage.removeItem('lastActivity')
      
      // 清理sessionStorage
      sessionStorage.clear()
      
      // 停止所有定时器
      this.stopSessionManagement()
      
      // 清理监听器
      this.listeners = []
      
      console.log('会话数据清理完成')
    } catch (error) {
      console.error('清理会话数据失败:', error)
    }
  }
}