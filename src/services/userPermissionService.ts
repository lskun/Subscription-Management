import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

/**
 * User permission and quota management service
 */

// Feature permission enumeration
export enum Permission {
  // Basic features
  VIEW_SUBSCRIPTIONS = 'view_subscriptions',
  CREATE_SUBSCRIPTIONS = 'create_subscriptions',
  EDIT_SUBSCRIPTIONS = 'edit_subscriptions',
  DELETE_SUBSCRIPTIONS = 'delete_subscriptions',
  
  // Analytics features - 细分权限
  VIEW_ANALYTICS = 'view_analytics',
  VIEW_MONTHLY_EXPENSES = 'view_monthly_expenses',
  VIEW_QUARTERLY_EXPENSES = 'view_quarterly_expenses', 
  VIEW_YEARLY_EXPENSES = 'view_yearly_expenses',
  VIEW_CATEGORY_EXPENSES = 'view_category_expenses',
  VIEW_ADVANCED_ANALYTICS = 'view_advanced_analytics',
  
  // Data operations
  EXPORT_DATA = 'export_data',
  EXPORT_SUBSCRIPTION_DATA = 'export_subscription_data',
  IMPORT_DATA = 'import_data',
  
  // Advanced features
  CUSTOM_CATEGORIES = 'custom_categories',
  CUSTOM_PAYMENT_METHODS = 'custom_payment_methods',
  BULK_OPERATIONS = 'bulk_operations',
  
  // API access
  API_ACCESS = 'api_access',
  WEBHOOK_ACCESS = 'webhook_access',
  
  // Admin features
  ADMIN_ACCESS = 'admin_access',
  USER_MANAGEMENT = 'user_management'
}

// Quota type enumeration
export enum QuotaType {
  MAX_SUBSCRIPTIONS = 'max_subscriptions',
  API_CALLS_PER_HOUR = 'api_calls_per_hour',
  API_CALLS_PER_DAY = 'api_calls_per_day',
  EXPORT_PER_MONTH = 'export_per_month',
  IMPORT_PER_MONTH = 'import_per_month',
  STORAGE_SIZE_MB = 'storage_size_mb'
}

// User subscription plan information
export interface UserSubscriptionPlan {
  id: string
  name: string
  features: Record<string, any>
  limits: Record<string, any>
  permissions: Permission[]
  quotas: Record<QuotaType, number>
}

// Quota usage information
export interface QuotaUsage {
  type: QuotaType
  used: number
  limit: number
  percentage: number
  resetDate?: Date
}

// Permission check result
export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
  upgradeRequired?: boolean
}

export class UserPermissionService {
  /**
   * Get user subscription plan information
   */
  static async getUserSubscriptionPlan(userId?: string): Promise<UserSubscriptionPlan | null> {
    try {
      const { useSettingsStore } = await import('@/store/settingsStore');
      const user = await useSettingsStore.getState().getCurrentUser();
      const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('User not logged in')
      }

      // Get user's current subscription plan
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
        console.error('Failed to get user subscription plan:', subscriptionError)
        return null
      }

      const plan = userSubscription.subscription_plans
      if (!plan) {
        return null
      }

      // Parse permissions and quotas
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
      console.error('Failed to get user subscription plan:', error)
      return null
    }
  }

  /**
   * Check if user has specific permission
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
          reason: 'Unable to get user subscription plan',
          upgradeRequired: true
        }
      }

      const hasPermission = plan.permissions.includes(permission)
      
      return {
        allowed: hasPermission,
        reason: hasPermission ? undefined : 'Current subscription plan does not support this feature',
        upgradeRequired: !hasPermission
      }
    } catch (error) {
      console.error('Failed to check user permission:', error)
      return {
        allowed: false,
        reason: 'Permission check failed',
        upgradeRequired: false
      }
    }
  }

  /**
   * Check user quota usage
   */
  static async checkQuota(
    quotaType: QuotaType,
    userId?: string
  ): Promise<QuotaUsage | null> {
    try {
      const { useSettingsStore } = await import('@/store/settingsStore');
    const user = await useSettingsStore.getState().getCurrentUser();
    const targetUserId = userId || user?.id
      
      if (!targetUserId) {
        throw new Error('User not logged in')
      }

      const plan = await this.getUserSubscriptionPlan(targetUserId)
      
      if (!plan) {
        return null
      }

      const limit = plan.quotas[quotaType]
      if (limit === undefined) {
        return null
      }

      // Get current usage
      const used = await this.getCurrentUsage(quotaType, targetUserId)
      
      return {
        type: quotaType,
        used,
        limit,
        percentage: limit > 0 ? (used / limit) * 100 : 0,
        resetDate: this.getQuotaResetDate(quotaType)
      }
    } catch (error) {
      console.error('Failed to check user quota:', error)
      return null
    }
  }

  /**
   * Check if action can be performed (permission + quota)
   */
  static async canPerformAction(
    permission: Permission,
    quotaType?: QuotaType,
    userId?: string
  ): Promise<PermissionCheckResult> {
    try {
      // Check permission
      const permissionResult = await this.hasPermission(permission, userId)
      if (!permissionResult.allowed) {
        return permissionResult
      }

      // Check quota if needed
      if (quotaType) {
        const quotaUsage = await this.checkQuota(quotaType, userId)
        
        if (quotaUsage && quotaUsage.limit > 0 && quotaUsage.used >= quotaUsage.limit) {
          return {
            allowed: false,
            reason: `Reached ${this.getQuotaDisplayName(quotaType)} limit (${quotaUsage.used}/${quotaUsage.limit})`,
            upgradeRequired: true
          }
        }
      }

      return {
        allowed: true
      }
    } catch (error) {
      console.error('Failed to check action permission:', error)
      return {
        allowed: false,
        reason: 'Permission check failed'
      }
    }
  }

  /**
   * Record quota usage (simplified - no database recording needed)
   */
  static async recordQuotaUsage(
    quotaType: QuotaType,
    amount: number = 1,
    userId?: string
  ): Promise<void> {
    // No database recording needed as per user requirement
    console.log(`Quota usage recorded: ${quotaType}, amount: ${amount}, userId: ${userId}`)
  }

  /**
   * Get all quota usage
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
      console.error('Failed to get quota usage:', error)
      return []
    }
  }

  /**
   * Get user permission list
   */
  static async getUserPermissions(userId?: string): Promise<Permission[]> {
    try {
      const plan = await this.getUserSubscriptionPlan(userId)
      return plan?.permissions || []
    } catch (error) {
      console.error('Failed to get user permissions:', error)
      return []
    }
  }

  /**
   * Parse plan features to permission list
   */
  private static parsePermissions(features: Record<string, any>): Permission[] {
    const permissions: Permission[] = []

    // Basic permissions (all plans have)
    permissions.push(
      Permission.VIEW_SUBSCRIPTIONS,
      Permission.CREATE_SUBSCRIPTIONS,
      Permission.EDIT_SUBSCRIPTIONS,
      Permission.DELETE_SUBSCRIPTIONS,
      Permission.VIEW_ANALYTICS
    )

    // Analytics permissions - 基础权限(免费版有)
    permissions.push(
      Permission.VIEW_MONTHLY_EXPENSES,
      Permission.VIEW_QUARTERLY_EXPENSES
    )

    // Premium analytics features
    if (features.yearly_expenses) {
      permissions.push(Permission.VIEW_YEARLY_EXPENSES)
    }

    if (features.category_expenses) {
      permissions.push(Permission.VIEW_CATEGORY_EXPENSES)
    }

    if (features.advanced_analytics) {
      permissions.push(Permission.VIEW_ADVANCED_ANALYTICS)
    }

    // Data operations
    if (features.data_export) {
      permissions.push(Permission.EXPORT_DATA, Permission.EXPORT_SUBSCRIPTION_DATA)
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
   * Parse plan limits to quota mapping
   */
  private static parseQuotas(limits: Record<string, any>): Record<QuotaType, number> {
    const quotas: Partial<Record<QuotaType, number>> = {}

    // Map limits to quota types
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
   * TODO Get current quota usage
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
          
          return subscriptionCount || 0

        case QuotaType.API_CALLS_PER_HOUR:
          // Need to implement API call record query here
          // Temporarily return 0, actual implementation needs to query API call logs
          return 0

        case QuotaType.API_CALLS_PER_DAY:
          // Need to implement API call record query here
          return 0

        case QuotaType.EXPORT_PER_MONTH:
          // Need to implement export record query here
          return 0

        case QuotaType.IMPORT_PER_MONTH:
          // Need to implement import record query here
          return 0

        case QuotaType.STORAGE_SIZE_MB:
          // Need to implement storage usage query here
          return 0

        default:
          return 0
      }
    } catch (error) {
      console.error('Failed to get quota usage:', error)
      return 0
    }
  }

  /**
   * Get quota reset date
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
   * Get quota display name
   */
  private static getQuotaDisplayName(quotaType: QuotaType): string {
    const displayNames = {
      [QuotaType.MAX_SUBSCRIPTIONS]: 'Maximum Subscriptions',
      [QuotaType.API_CALLS_PER_HOUR]: 'API Calls Per Hour',
      [QuotaType.API_CALLS_PER_DAY]: 'Daily API Calls',
      [QuotaType.EXPORT_PER_MONTH]: 'Monthly Exports',
      [QuotaType.IMPORT_PER_MONTH]: 'Monthly Imports',
      [QuotaType.STORAGE_SIZE_MB]: 'Storage Space'
    }

    return displayNames[quotaType] || quotaType
  }

  /**
   * Permission validation middleware (for components)
   */
  static createPermissionGuard(permission: Permission, quotaType?: QuotaType) {
    return async (userId?: string): Promise<PermissionCheckResult> => {
      return await this.canPerformAction(permission, quotaType, userId)
    }
  }
}