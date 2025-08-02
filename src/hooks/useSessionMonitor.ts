import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface SessionMonitorState {
  isHealthy: boolean
  issues: string[]
  recommendations: string[]
  needsAttention: boolean
  lastCheck: number
}

interface SessionMonitorOptions {
  checkInterval?: number // 检查间隔，默认30秒
  autoRefresh?: boolean // 是否自动刷新
  warningThreshold?: number // 警告阈值，默认5分钟
}

export function useSessionMonitor(options: SessionMonitorOptions = {}) {
  const {
    checkInterval = 30000, // 30秒
    autoRefresh = false,
    warningThreshold = 5 * 60 * 1000 // 5分钟
  } = options

  const {
    isSessionValid,
    timeUntilExpiry,
    checkSessionHealth,
    refreshSession,
    recoverSession
  } = useAuth()

  const [monitorState, setMonitorState] = useState<SessionMonitorState>({
    isHealthy: true,
    issues: [],
    recommendations: [],
    needsAttention: false,
    lastCheck: 0
  })

  const [isChecking, setIsChecking] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 检查会话健康状态
  const checkHealth = useCallback(async () => {
    if (!isSessionValid || isChecking) return

    setIsChecking(true)
    try {
      const health = await checkSessionHealth()
      const needsAttention = !health.isHealthy || 
        (timeUntilExpiry !== null && timeUntilExpiry <= warningThreshold)

      setMonitorState({
        ...health,
        needsAttention,
        lastCheck: Date.now()
      })

      // 如果启用自动刷新且需要刷新
      if (autoRefresh && needsAttention && timeUntilExpiry && timeUntilExpiry > 0) {
        await handleAutoRefresh()
      }
    } catch (error) {
      console.error('会话健康检查失败:', error)
      setMonitorState({
        isHealthy: false,
        issues: ['健康检查失败'],
        recommendations: ['请刷新页面或重新登录'],
        needsAttention: true,
        lastCheck: Date.now()
      })
    } finally {
      setIsChecking(false)
    }
  }, [isSessionValid, isChecking, checkSessionHealth, timeUntilExpiry, warningThreshold, autoRefresh])

  // 自动刷新会话
  const handleAutoRefresh = useCallback(async () => {
    if (isRefreshing) return false

    setIsRefreshing(true)
    try {
      const success = await refreshSession()
      if (success) {
        console.log('会话自动刷新成功')
        // 重新检查健康状态
        setTimeout(checkHealth, 1000)
      }
      return success
    } catch (error) {
      console.error('自动刷新失败:', error)
      return false
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, refreshSession, checkHealth])

  // 手动刷新会话
  const manualRefresh = useCallback(async () => {
    return await handleAutoRefresh()
  }, [handleAutoRefresh])

  // 恢复会话管理
  const recoverSessionManagement = useCallback(async () => {
    try {
      const success = await recoverSession()
      if (success) {
        // 重新检查健康状态
        setTimeout(checkHealth, 1000)
      }
      return success
    } catch (error) {
      console.error('恢复会话管理失败:', error)
      return false
    }
  }, [recoverSession, checkHealth])

  // 定期检查会话健康状态
  useEffect(() => {
    if (!isSessionValid) {
      setMonitorState({
        isHealthy: false,
        issues: ['用户未登录'],
        recommendations: ['请登录以继续使用'],
        needsAttention: true,
        lastCheck: Date.now()
      })
      return
    }

    // 立即检查一次
    checkHealth()

    // 设置定期检查
    const timer = setInterval(checkHealth, checkInterval)

    return () => clearInterval(timer)
  }, [isSessionValid, checkHealth, checkInterval])

  // 监听会话状态变化
  useEffect(() => {
    if (isSessionValid && timeUntilExpiry !== null) {
      const needsAttention = timeUntilExpiry <= warningThreshold
      
      setMonitorState(prev => ({
        ...prev,
        needsAttention: needsAttention || !prev.isHealthy
      }))
    }
  }, [isSessionValid, timeUntilExpiry, warningThreshold])

  return {
    // 状态
    ...monitorState,
    isChecking,
    isRefreshing,
    
    // 方法
    checkHealth,
    manualRefresh,
    recoverSessionManagement,
    
    // 计算属性
    hasIssues: monitorState.issues.length > 0,
    hasRecommendations: monitorState.recommendations.length > 0,
    timeSinceLastCheck: Date.now() - monitorState.lastCheck
  }
}

// 简化版本的Hook，只返回基本状态
export function useSessionStatus() {
  const { isSessionValid, timeUntilExpiry, user } = useAuth()
  
  const isExpiringSoon = timeUntilExpiry !== null && timeUntilExpiry <= 5 * 60 * 1000 // 5分钟
  const isLoggedIn = !!user && isSessionValid
  
  return {
    isLoggedIn,
    isExpiringSoon,
    timeUntilExpiry,
    user
  }
}

// 会话警告Hook
export function useSessionWarning(warningThreshold: number = 5 * 60 * 1000) {
  const { isSessionValid, timeUntilExpiry } = useAuth()
  const [shouldShowWarning, setShouldShowWarning] = useState(false)
  
  useEffect(() => {
    if (!isSessionValid || timeUntilExpiry === null) {
      setShouldShowWarning(false)
      return
    }
    
    setShouldShowWarning(timeUntilExpiry <= warningThreshold && timeUntilExpiry > 0)
  }, [isSessionValid, timeUntilExpiry, warningThreshold])
  
  return {
    shouldShowWarning,
    timeUntilExpiry
  }
}