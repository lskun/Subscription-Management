import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

/**
 * 用户权限和配额管理服务
 */

// 功能权限枚举
export enum Permission {
  // 基础功能
  VIEW_SUBSCRIPTIONS = 'view_subscriptions',
  CREATE_SUBSCRIPTIONS = 'create_subscriptions',
  EDIT_SUBSCRIPTIONS = 'edit_subscriptions',
  DELETE_SUBSCRIPTIONS = 'delete_subscriptions',
  
  // 分析功能
  VIEW_ANALYTICS = 'view_analytics',
  EXPORT_DATA = 'export_data',
  IMPORT_DATA = 'import_data',
  
  // 高级功能
  CUSTOM_CATEGORIES = 'custom_categories',
  CUSTOM_PAYMENT_METHODS = 'custom_payment_methods',
  BULK_OPERATIONS = 'bulk_operations',
  
  // API访问
  API_ACCESS = 'api_access',
  WEBHOOK_ACCESS = 'webhook_access',
  
  // 管理功能
  ADMIN_ACCESS = 'admin_access',
  USER_MANAGEMENT = 'user_management'
}

// 配额类型枚举
export enum QuotaType {
  MAX_SUBSCRIPTIONS = 'max_subscriptions',
  API_CALLS_PER_HOUR = 'api_calls_per_hour',
  API_CALLS_PER_DAY = 'api_calls_per_day',
  EXPORT_PER_MONTH = 'export_per_month',
  IMPORT_PER_MONTH = 'import_per_month',
  STORAGE_SIZE_MB = 'storage_size_mb'
}

// 用户订阅计划信息
export interface UserSubscriptionPlan {
  id: string
  name: string
  features: Record<string, any>
  limits: Record<string, any>
  permissions: Permission[]
  quotas: Record<QuotaType, number>
}

// 配额使用情况
export interface QuotaUsage {
  type: QuotaType
  used: number
  limit: number
  percentage: number
  resetDate?: Date
}

// 权限检查结果
export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
  upgradeRequired?: boolean
}

export class UserPermissionService {
  /**
   * 获取用户订阅计划信息
   */
  static async getUserSubscriptionPlan(userId?: string): Promise<UserSubscriptionPlan | null> {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      // 获取用户当前订阅计划
      const { data: userSubscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            id,
            name,
            features,
            limits
          )
        `)
        .eq('user_id', targetUserId)
        .eq('status', 'active')
        .single()

      if (subscriptionError) {
        console.error('获取用户订阅计划失败:', subscriptionError)
        return null
      }

      const plan = userSubscription.subscription_plans
      if (!plan) {
        return null
      }

      // 解析权限和配额
      const permissions = this.parsePermissions(plan.features)
      const quotas = this.parseQuotas(plan.limits)

      return {
        id: plan.id,
        name: plan.name,
        features: plan.features,
        limits: plan.limits,
        permissions,
        quotas
      }
    } catch (error) {
      console.error('获取用户订阅计划失败:', error)
      return null
    }
  }

  /**
   * 检查用户是否有特定权限
   */
  static async hasPermission(
    permission: Permission,
    userId?: string
  ): Promise<PermissionCheckResult> {
    try {
      const plan = await this.getUserSubscriptionPlan(userId)
      
      if (!plan) {
        return {
          allowed: false,
          reason: '无法获取用户订阅计划',
          upgradeRequired: true
        }
      }

      const hasPermission = plan.permissions.includes(permission)
      
      return {
        allowed: hasPermission,
        reason: hasPermission ? undefined : '当前订阅计划不支持此功能',
        upgradeRequired: !hasPermission
      }
    } catch (error) {
      console.error('检查用户权限失败:', error)
      return {
        allowed: false,
        reason: '权限检查失败',
        upgradeRequired: false
      }
    }
  }

  /**
   * 检查用户配额使用情况
   */
  static async checkQuota(
    quotaType: QuotaType,
    userId?: string
  ): Promise<QuotaUsage | null> {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      const plan = await this.getUserSubscriptionPlan(targetUserId)
      
      if (!plan) {
        return null
      }

      const limit = plan.quotas[quotaType]
      if (limit === undefined) {
        return null
      }

      // 获取当前使用量
      const used = await this.getCurrentUsage(quotaType, targetUserId)
      
      return {
        type: quotaType,
        used,
        limit,
        percentage: limit > 0 ? (used / limit) * 100 : 0,
        resetDate: this.getQuotaResetDate(quotaType)
      }
    } catch (error) {
      console.error('检查用户配额失败:', error)
      return null
    }
  }

  /**
   * 检查是否可以执行操作（权限+配额）
   */
  static async canPerformAction(
    permission: Permission,
    quotaType?: QuotaType,
    userId?: string
  ): Promise<PermissionCheckResult> {
    try {
      // 检查权限
      const permissionResult = await this.hasPermission(permission, userId)
      if (!permissionResult.allowed) {
        return permissionResult
      }

      // 如果需要检查配额
      if (quotaType) {
        const quotaUsage = await this.checkQuota(quotaType, userId)
        
        if (quotaUsage && quotaUsage.limit > 0 && quotaUsage.used >= quotaUsage.limit) {
          return {
            allowed: false,
            reason: `已达到${this.getQuotaDisplayName(quotaType)}限制 (${quotaUsage.used}/${quotaUsage.limit})`,
            upgradeRequired: true
          }
        }
      }

      return {
        allowed: true
      }
    } catch (error) {
      console.error('检查操作权限失败:', error)
      return {
        allowed: false,
        reason: '权限检查失败'
      }
    }
  }

  /**
   * 记录配额使用
   */
  static async recordQuotaUsage(
    quotaType: QuotaType,
    amount: number = 1,
    userId?: string
  ): Promise<void> {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      
      if (!targetUserId) {
        throw new Error('用户未登录')
      }

      // 记录使用情况到数据库
      const { error } = await supabase
        .from('user_quota_usage')
        .insert({
          user_id: targetUserId,
          quota_type: quotaType,
          amount,
          recorded_at: new Date().toISOString()
        })

      if (error) {
        console.error('记录配额使用失败:', error)
      }
    } catch (error) {
      console.error('记录配额使用异常:', error)
    }
  }

  /**
   * 获取所有配额使用情况
   */
  static async getAllQuotaUsage(userId?: string): Promise<QuotaUsage[]> {
    try {
      const plan = await this.getUserSubscriptionPlan(userId)
      
      if (!plan) {
        return []
      }

      const quotaUsages: QuotaUsage[] = []
      
      for (const [quotaType, limit] of Object.entries(plan.quotas)) {
        const usage = await this.checkQuota(quotaType as QuotaType, userId)
        if (usage) {
          quotaUsages.push(usage)
        }
      }

      return quotaUsages
    } catch (error) {
      console.error('获取配额使用情况失败:', error)
      return []
    }
  }

  /**
   * 获取用户权限列表
   */
  static async getUserPermissions(userId?: string): Promise<Permission[]> {
    try {
      const plan = await this.getUserSubscriptionPlan(userId)
      return plan?.permissions || []
    } catch (error) {
      console.error('获取用户权限失败:', error)
      return []
    }
  }

  /**
   * 解析计划功能为权限列表
   */
  private static parsePermissions(features: Record<string, any>): Permission[] {
    const permissions: Permission[] = []

    // 基础权限（所有计划都有）
    permissions.push(
      Permission.VIEW_SUBSCRIPTIONS,
      Permission.CREATE_SUBSCRIPTIONS,
      Permission.EDIT_SUBSCRIPTIONS,
      Permission.DELETE_SUBSCRIPTIONS,
      Permission.VIEW_ANALYTICS
    )

    // 根据功能特性添加权限
    if (features.data_export) {
      permissions.push(Permission.EXPORT_DATA)
    }

    if (features.data_import) {
      permissions.push(Permission.IMPORT_DATA)
    }

    if (features.custom_categories) {
      permissions.push(Permission.CUSTOM_CATEGORIES)
    }

    if (features.custom_payment_methods) {
      permissions.push(Permission.CUSTOM_PAYMENT_METHODS)
    }

    if (features.bulk_operations) {
      permissions.push(Permission.BULK_OPERATIONS)
    }

    if (features.api_access) {
      permissions.push(Permission.API_ACCESS)
    }

    if (features.webhook_access) {
      permissions.push(Permission.WEBHOOK_ACCESS)
    }

    if (features.admin_access) {
      permissions.push(Permission.ADMIN_ACCESS, Permission.USER_MANAGEMENT)
    }

    return permissions
  }

  /**
   * 解析计划限制为配额映射
   */
  private static parseQuotas(limits: Record<string, any>): Record<QuotaType, number> {
    const quotas: Partial<Record<QuotaType, number>> = {}

    // 映射限制到配额类型
    if (limits.max_subscriptions !== undefined) {
      quotas[QuotaType.MAX_SUBSCRIPTIONS] = limits.max_subscriptions
    }

    if (limits.api_calls_per_hour !== undefined) {
      quotas[QuotaType.API_CALLS_PER_HOUR] = limits.api_calls_per_hour
    }

    if (limits.api_calls_per_day !== undefined) {
      quotas[QuotaType.API_CALLS_PER_DAY] = limits.api_calls_per_day
    }

    if (limits.export_per_month !== undefined) {
      quotas[QuotaType.EXPORT_PER_MONTH] = limits.export_per_month
    }

    if (limits.import_per_month !== undefined) {
      quotas[QuotaType.IMPORT_PER_MONTH] = limits.import_per_month
    }

    if (limits.storage_size_mb !== undefined) {
      quotas[QuotaType.STORAGE_SIZE_MB] = limits.storage_size_mb
    }

    return quotas as Record<QuotaType, number>
  }

  /**
   * 获取当前配额使用量
   */
  private static async getCurrentUsage(
    quotaType: QuotaType,
    userId: string
  ): Promise<number> {
    try {
      switch (quotaType) {
        case QuotaType.MAX_SUBSCRIPTIONS:
          const { count: subscriptionCount } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'active')
          
          return subscriptionCount || 0

        case QuotaType.API_CALLS_PER_HOUR:
          // 这里需要实现API调用记录的查询
          // 暂时返回0，实际实现需要查询API调用日志
          return 0

        case QuotaType.API_CALLS_PER_DAY:
          // 这里需要实现API调用记录的查询
          return 0

        case QuotaType.EXPORT_PER_MONTH:
          // 这里需要实现导出记录的查询
          return 0

        case QuotaType.IMPORT_PER_MONTH:
          // 这里需要实现导入记录的查询
          return 0

        case QuotaType.STORAGE_SIZE_MB:
          // 这里需要实现存储使用量的查询
          return 0

        default:
          return 0
      }
    } catch (error) {
      console.error('获取配额使用量失败:', error)
      return 0
    }
  }

  /**
   * 获取配额重置日期
   */
  private static getQuotaResetDate(quotaType: QuotaType): Date | undefined {
    const now = new Date()
    
    switch (quotaType) {
      case QuotaType.API_CALLS_PER_HOUR:
        const nextHour = new Date(now)
        nextHour.setHours(now.getHours() + 1, 0, 0, 0)
        return nextHour

      case QuotaType.API_CALLS_PER_DAY:
        const nextDay = new Date(now)
        nextDay.setDate(now.getDate() + 1)
        nextDay.setHours(0, 0, 0, 0)
        return nextDay

      case QuotaType.EXPORT_PER_MONTH:
      case QuotaType.IMPORT_PER_MONTH:
        const nextMonth = new Date(now)
        nextMonth.setMonth(now.getMonth() + 1, 1)
        nextMonth.setHours(0, 0, 0, 0)
        return nextMonth

      default:
        return undefined
    }
  }

  /**
   * 获取配额显示名称
   */
  private static getQuotaDisplayName(quotaType: QuotaType): string {
    const displayNames = {
      [QuotaType.MAX_SUBSCRIPTIONS]: '最大订阅数量',
      [QuotaType.API_CALLS_PER_HOUR]: '每小时API调用',
      [QuotaType.API_CALLS_PER_DAY]: '每日API调用',
      [QuotaType.EXPORT_PER_MONTH]: '每月导出次数',
      [QuotaType.IMPORT_PER_MONTH]: '每月导入次数',
      [QuotaType.STORAGE_SIZE_MB]: '存储空间'
    }

    return displayNames[quotaType] || quotaType
  }

  /**
   * 权限验证中间件（用于组件）
   */
  static createPermissionGuard(permission: Permission, quotaType?: QuotaType) {
    return async (userId?: string): Promise<PermissionCheckResult> => {
      return await this.canPerformAction(permission, quotaType, userId)
    }
  }
}