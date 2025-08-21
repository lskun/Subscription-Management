import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
  UserPermissionService, 
  Permission, 
  QuotaType, 
  PermissionCheckResult,
  QuotaUsage,
  UserSubscriptionPlan
} from '@/services/userPermissionService'

// 全局缓存
let globalPlanCache: {
  plan: UserSubscriptionPlan | null
  userId: string | null
  timestamp: number
  loading: boolean
} = {
  plan: null,
  userId: null,
  timestamp: 0,
  loading: false
}

const CACHE_DURATION = 30 * 60 * 1000 // 30分钟缓存

/**
 * 优化的用户订阅计划Hook - 使用全局缓存
 */
export function useUserPlan() {
  const { user } = useAuth()
  const [plan, setPlan] = useState<UserSubscriptionPlan | null>(globalPlanCache.plan)
  const [loading, setLoading] = useState(globalPlanCache.loading)
  const isMountedRef = useRef(true)

  const loadPlan = useCallback(async () => {
    if (!user?.id) {
      setPlan(null)
      setLoading(false)
      return
    }

    // 检查缓存是否有效
    const now = Date.now()
    const cacheValid = globalPlanCache.userId === user.id && 
      globalPlanCache.timestamp > 0 && 
      (now - globalPlanCache.timestamp) < CACHE_DURATION

    if (cacheValid && globalPlanCache.plan) {
      setPlan(globalPlanCache.plan)
      setLoading(false)
      return
    }

    // 如果正在加载中，等待加载完成
    if (globalPlanCache.loading && globalPlanCache.userId === user.id) {
      setLoading(true)
      // 等待加载完成
      const checkCache = () => {
        if (!globalPlanCache.loading && isMountedRef.current) {
          setPlan(globalPlanCache.plan)
          setLoading(false)
        } else if (globalPlanCache.loading) {
          setTimeout(checkCache, 100)
        }
      }
      setTimeout(checkCache, 100)
      return
    }

    try {
      // 设置全局加载状态
      globalPlanCache.loading = true
      globalPlanCache.userId = user.id
      setLoading(true)

      const userPlan = await UserPermissionService.getUserSubscriptionPlan(user.id)
      
      // 更新全局缓存
      globalPlanCache = {
        plan: userPlan,
        userId: user.id,
        timestamp: now,
        loading: false
      }

      if (isMountedRef.current) {
        setPlan(userPlan)
        setLoading(false)
      }
    } catch (error) {
      console.error('获取用户计划失败:', error)
      
      globalPlanCache = {
        plan: null,
        userId: user.id,
        timestamp: now,
        loading: false
      }

      if (isMountedRef.current) {
        setPlan(null)
        setLoading(false)
      }
    }
  }, [user?.id])

  useEffect(() => {
    isMountedRef.current = true
    loadPlan()
    
    return () => {
      isMountedRef.current = false
    }
  }, [loadPlan])

  const reload = useCallback(() => {
    // 清除缓存并重新加载
    globalPlanCache = {
      plan: null,
      userId: null,
      timestamp: 0,
      loading: false
    }
    loadPlan()
  }, [loadPlan])

  return {
    plan,
    loading,
    reload,
    isFreePlan: plan?.name === '免费版',
    hasFeature: useCallback((feature: string) => plan?.features[feature] === true, [plan?.features]),
    getQuotaLimit: useCallback((quotaType: QuotaType) => plan?.quotas[quotaType] || 0, [plan?.quotas])
  }
}

/**
 * 优化的权限检查Hook - 基于缓存的计划数据
 */
export function usePermissions(permissions: Permission[]) {
  const { plan, loading: planLoading } = useUserPlan()
  
  // 使用useMemo稳定permissions数组的引用
  const stablePermissions = useMemo(() => permissions, [permissions.join(',')])
  
  const permissionStates = useMemo(() => {
    if (!plan) {
      return stablePermissions.reduce((acc, permission) => {
        acc[permission] = { allowed: false, reason: planLoading ? '检查中...' : '无法获取用户计划' }
        return acc
      }, {} as Record<Permission, PermissionCheckResult>)
    }

    return stablePermissions.reduce((acc, permission) => {
      const hasPermission = plan.permissions.includes(permission)
      acc[permission] = {
        allowed: hasPermission,
        reason: hasPermission ? undefined : '当前订阅计划不支持此功能',
        upgradeRequired: !hasPermission
      }
      return acc
    }, {} as Record<Permission, PermissionCheckResult>)
  }, [plan, stablePermissions, planLoading])

  const hasPermission = useCallback((permission: Permission) => {
    return permissionStates[permission]?.allowed || false
  }, [permissionStates])

  const getPermissionReason = useCallback((permission: Permission) => {
    return permissionStates[permission]?.reason
  }, [permissionStates])

  return {
    permissionStates,
    loading: planLoading,
    hasPermission,
    getPermissionReason,
    recheck: () => {} // 不需要单独刷新，通过useUserPlan统一管理
  }
}

/**
 * 优化的配额检查Hook - 基于缓存的计划数据
 */
export function useQuota(quotaType: QuotaType) {
  const { user } = useAuth()
  const { plan, loading: planLoading } = useUserPlan()
  const [quota, setQuota] = useState<QuotaUsage | null>(null)
  const [loading, setLoading] = useState(true)

  const checkQuota = useCallback(async () => {
    if (!user?.id || !plan) {
      setQuota(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const quotaUsage = await UserPermissionService.checkQuota(quotaType, user.id)
      setQuota(quotaUsage)
    } catch (error) {
      console.error('配额检查失败:', error)
      setQuota(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id, plan, quotaType])

  useEffect(() => {
    if (!planLoading) {
      checkQuota()
    }
  }, [checkQuota, planLoading])

  const recordUsage = useCallback(async (amount: number = 1) => {
    if (!user?.id) return false

    try {
      await UserPermissionService.recordQuotaUsage(quotaType, amount, user.id)
      // 重新检查配额
      await checkQuota()
      return true
    } catch (error) {
      console.error('记录配额使用失败:', error)
      return false
    }
  }, [user?.id, quotaType, checkQuota])

  return {
    quota,
    loading: loading || planLoading,
    recheck: checkQuota,
    recordUsage,
    isNearLimit: quota ? quota.percentage >= 80 : false,
    isAtLimit: quota ? quota.used >= quota.limit && quota.limit > 0 : false
  }
}

/**
 * 清除权限缓存的辅助函数
 */
export function clearPermissionCache() {
  globalPlanCache = {
    plan: null,
    userId: null,
    timestamp: 0,
    loading: false
  }
}