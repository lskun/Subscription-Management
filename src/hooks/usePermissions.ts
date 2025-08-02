import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
  UserPermissionService, 
  Permission, 
  QuotaType, 
  PermissionCheckResult,
  QuotaUsage,
  UserSubscriptionPlan
} from '@/services/userPermissionService'

/**
 * 权限检查Hook
 */
export function usePermission(permission: Permission, quotaType?: QuotaType) {
  const { user } = useAuth()
  const [result, setResult] = useState<PermissionCheckResult>({
    allowed: false,
    reason: '检查中...'
  })
  const [loading, setLoading] = useState(true)

  const checkPermission = useCallback(async () => {
    if (!user) {
      setResult({
        allowed: false,
        reason: '用户未登录'
      })
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const permissionResult = await UserPermissionService.canPerformAction(
        permission,
        quotaType,
        user.id
      )
      setResult(permissionResult)
    } catch (error) {
      console.error('权限检查失败:', error)
      setResult({
        allowed: false,
        reason: '权限检查失败'
      })
    } finally {
      setLoading(false)
    }
  }, [user, permission, quotaType])

  useEffect(() => {
    checkPermission()
  }, [checkPermission])

  return {
    ...result,
    loading,
    recheck: checkPermission
  }
}

/**
 * 配额使用情况Hook
 */
export function useQuota(quotaType: QuotaType) {
  const { user } = useAuth()
  const [quota, setQuota] = useState<QuotaUsage | null>(null)
  const [loading, setLoading] = useState(true)

  const checkQuota = useCallback(async () => {
    if (!user) {
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
  }, [user, quotaType])

  useEffect(() => {
    checkQuota()
  }, [checkQuota])

  const recordUsage = useCallback(async (amount: number = 1) => {
    if (!user) return false

    try {
      await UserPermissionService.recordQuotaUsage(quotaType, amount, user.id)
      // 重新检查配额
      await checkQuota()
      return true
    } catch (error) {
      console.error('记录配额使用失败:', error)
      return false
    }
  }, [user, quotaType, checkQuota])

  return {
    quota,
    loading,
    recheck: checkQuota,
    recordUsage,
    isNearLimit: quota ? quota.percentage >= 80 : false,
    isAtLimit: quota ? quota.used >= quota.limit && quota.limit > 0 : false
  }
}

/**
 * 用户订阅计划Hook
 */
export function useUserPlan() {
  const { user } = useAuth()
  const [plan, setPlan] = useState<UserSubscriptionPlan | null>(null)
  const [loading, setLoading] = useState(true)

  const loadPlan = useCallback(async () => {
    if (!user) {
      setPlan(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const userPlan = await UserPermissionService.getUserSubscriptionPlan(user.id)
      setPlan(userPlan)
    } catch (error) {
      console.error('获取用户计划失败:', error)
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadPlan()
  }, [loadPlan])

  return {
    plan,
    loading,
    reload: loadPlan,
    isFreePlan: plan?.name === '免费版',
    hasFeature: (feature: string) => plan?.features[feature] === true,
    getQuotaLimit: (quotaType: QuotaType) => plan?.quotas[quotaType] || 0
  }
}

/**
 * 所有配额使用情况Hook
 */
export function useAllQuotas() {
  const { user } = useAuth()
  const [quotas, setQuotas] = useState<QuotaUsage[]>([])
  const [loading, setLoading] = useState(true)

  const loadQuotas = useCallback(async () => {
    if (!user) {
      setQuotas([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const allQuotas = await UserPermissionService.getAllQuotaUsage(user.id)
      setQuotas(allQuotas)
    } catch (error) {
      console.error('获取配额使用情况失败:', error)
      setQuotas([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadQuotas()
  }, [loadQuotas])

  return {
    quotas,
    loading,
    reload: loadQuotas,
    hasWarnings: quotas.some(q => q.percentage >= 80),
    hasLimitsReached: quotas.some(q => q.used >= q.limit && q.limit > 0)
  }
}

/**
 * 权限守卫组件Hook
 */
export function usePermissionGuard() {
  const checkPermission = useCallback(async (
    permission: Permission,
    quotaType?: QuotaType,
    userId?: string
  ): Promise<PermissionCheckResult> => {
    return await UserPermissionService.canPerformAction(permission, quotaType, userId)
  }, [])

  const withPermissionCheck = useCallback(<T extends any[]>(
    permission: Permission,
    quotaType: QuotaType | undefined,
    action: (...args: T) => Promise<any> | any,
    onDenied?: (result: PermissionCheckResult) => void
  ) => {
    return async (...args: T) => {
      const result = await checkPermission(permission, quotaType)
      
      if (!result.allowed) {
        if (onDenied) {
          onDenied(result)
        } else {
          console.warn('操作被拒绝:', result.reason)
        }
        return null
      }

      return await action(...args)
    }
  }, [checkPermission])

  return {
    checkPermission,
    withPermissionCheck
  }
}

/**
 * 权限状态管理Hook
 */
export function usePermissions(permissions: Permission[]) {
  const { user } = useAuth()
  const [permissionStates, setPermissionStates] = useState<Record<Permission, PermissionCheckResult>>({} as any)
  const [loading, setLoading] = useState(true)

  const checkAllPermissions = useCallback(async () => {
    if (!user) {
      const deniedStates = permissions.reduce((acc, permission) => {
        acc[permission] = { allowed: false, reason: '用户未登录' }
        return acc
      }, {} as Record<Permission, PermissionCheckResult>)
      
      setPermissionStates(deniedStates)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const results = await Promise.all(
        permissions.map(async (permission) => {
          const result = await UserPermissionService.hasPermission(permission, user.id)
          return [permission, result] as [Permission, PermissionCheckResult]
        })
      )

      const statesMap = results.reduce((acc, [permission, result]) => {
        acc[permission] = result
        return acc
      }, {} as Record<Permission, PermissionCheckResult>)

      setPermissionStates(statesMap)
    } catch (error) {
      console.error('批量权限检查失败:', error)
      const errorStates = permissions.reduce((acc, permission) => {
        acc[permission] = { allowed: false, reason: '权限检查失败' }
        return acc
      }, {} as Record<Permission, PermissionCheckResult>)
      
      setPermissionStates(errorStates)
    } finally {
      setLoading(false)
    }
  }, [user, permissions])

  useEffect(() => {
    checkAllPermissions()
  }, [checkAllPermissions])

  const hasPermission = useCallback((permission: Permission) => {
    return permissionStates[permission]?.allowed || false
  }, [permissionStates])

  const getPermissionReason = useCallback((permission: Permission) => {
    return permissionStates[permission]?.reason
  }, [permissionStates])

  return {
    permissionStates,
    loading,
    hasPermission,
    getPermissionReason,
    recheck: checkAllPermissions
  }
}