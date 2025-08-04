import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

/**
 * 用户缓存服务
 * 用于减少重复的 auth.getUser() 调用
 */
export class UserCacheService {
  private static userCache: User | null = null
  private static cacheTimestamp: number = 0
  private static readonly CACHE_DURATION = 5000 // 5秒缓存
  private static pendingRequest: Promise<User | null> | null = null

  /**
   * 获取当前用户（带缓存）
   */
  static async getCurrentUser(): Promise<User | null> {
    const now = Date.now()
    
    // 如果缓存有效，直接返回缓存的用户
    if (this.userCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.userCache
    }

    // 如果有正在进行的请求，等待它完成
    if (this.pendingRequest) {
      return this.pendingRequest
    }

    // 创建新的请求
    this.pendingRequest = this.fetchUser()
    
    try {
      const user = await this.pendingRequest
      return user
    } finally {
      this.pendingRequest = null
    }
  }

  /**
   * 实际获取用户的方法
   */
  private static async fetchUser(): Promise<User | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('获取用户信息失败:', error)
        this.clearCache()
        return null
      }

      // 更新缓存
      this.userCache = user
      this.cacheTimestamp = Date.now()
      
      return user
    } catch (error) {
      console.error('获取用户信息异常:', error)
      this.clearCache()
      return null
    }
  }

  /**
   * 清除用户缓存
   */
  static clearCache(): void {
    this.userCache = null
    this.cacheTimestamp = 0
    this.pendingRequest = null
  }

  /**
   * 更新缓存中的用户信息
   */
  static updateCache(user: User | null): void {
    this.userCache = user
    this.cacheTimestamp = Date.now()
  }

  /**
   * 强制刷新用户信息
   */
  static async forceRefresh(): Promise<User | null> {
    this.clearCache()
    return this.getCurrentUser()
  }

  /**
   * 获取缓存状态
   */
  static getCacheStatus(): {
    hasCache: boolean
    cacheAge: number
    isValid: boolean
  } {
    const now = Date.now()
    const cacheAge = now - this.cacheTimestamp
    
    return {
      hasCache: this.userCache !== null,
      cacheAge,
      isValid: this.userCache !== null && cacheAge < this.CACHE_DURATION
    }
  }
}