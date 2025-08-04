import { adminAuthService } from '../services/adminAuthService';

/**
 * 管理员权限验证中间件
 */
export class AdminMiddleware {
  /**
   * 验证管理员权限
   */
  static async requireAdmin(): Promise<{ success: boolean; adminUser?: any; error?: string }> {
    try {
      const isAdmin = await adminAuthService.isAdmin();
      
      if (!isAdmin) {
        return { success: false, error: '需要管理员权限' };
      }
      
      const adminUser = await adminAuthService.getCurrentAdminUser();
      return { success: true, adminUser };
    } catch (error) {
      console.error('验证管理员权限失败:', error);
      return { success: false, error: '权限验证失败' };
    }
  }

  /**
   * 验证特定权限
   */
  static async requirePermission(permission: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 直接检查权限，hasPermission 方法内部已经包含了管理员检查
      const hasPermission = await adminAuthService.hasPermission(permission);
      
      if (!hasPermission) {
        return { success: false, error: `需要权限: ${permission}` };
      }
      
      return { success: true };
    } catch (error) {
      console.error('验证权限失败:', error);
      return { success: false, error: '权限验证失败' };
    }
  }

  /**
   * 验证用户是否拥有所有指定权限
   */
  static async requireAllPermissions(permissions: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      // 使用批量权限检查
      const permissionResults = await adminAuthService.hasPermissions(permissions);
      
      for (const permission of permissions) {
        if (!permissionResults[permission]) {
          return { success: false, error: `需要权限: ${permission}` };
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('验证权限失败:', error);
      return { success: false, error: '权限验证失败' };
    }
  }

  /**
   * 验证用户是否拥有任一指定权限
   */
  static async requireAnyPermission(permissions: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      // 使用批量权限检查
      const permissionResults = await adminAuthService.hasPermissions(permissions);
      
      for (const permission of permissions) {
        if (permissionResults[permission]) {
          return { success: true };
        }
      }
      
      return { success: false, error: `需要以下权限之一: ${permissions.join(', ')}` };
    } catch (error) {
      console.error('验证权限失败:', error);
      return { success: false, error: '权限验证失败' };
    }
  }

  /**
   * 包装需要管理员权限的函数
   */
  static withAdminPermission<T extends any[], R>(
    fn: (...args: T) => Promise<R>
  ) {
    return async (...args: T): Promise<R> => {
      const check = await this.requireAdmin();
      if (!check.success) {
        throw new Error(check.error || '需要管理员权限');
      }
      
      return fn(...args);
    };
  }

  /**
   * 包装需要特定权限的函数
   */
  static withPermission<T extends any[], R>(
    permission: string,
    fn: (...args: T) => Promise<R>
  ) {
    return async (...args: T): Promise<R> => {
      const check = await this.requirePermission(permission);
      if (!check.success) {
        throw new Error(check.error || `需要权限: ${permission}`);
      }
      
      return fn(...args);
    };
  }

  /**
   * 记录管理员操作并执行函数
   */
  static withLogging<T extends any[], R>(
    operationType: string,
    targetType: string,
    fn: (...args: T) => Promise<R>,
    getTargetId?: (...args: T) => string | null,
    getDetails?: (...args: T) => Record<string, any>
  ) {
    return async (...args: T): Promise<R> => {
      try {
        // 执行函数
        const result = await fn(...args);
        
        // 记录操作日志
        const targetId = getTargetId ? getTargetId(...args) : null;
        const details = getDetails ? getDetails(...args) : {};
        
        await adminAuthService.logOperation(
          operationType,
          targetType,
          targetId,
          {
            ...details,
            success: true,
            result: typeof result === 'object' ? JSON.stringify(result) : String(result)
          }
        );
        
        return result;
      } catch (error) {
        // 记录错误日志
        const targetId = getTargetId ? getTargetId(...args) : null;
        const details = getDetails ? getDetails(...args) : {};
        
        await adminAuthService.logOperation(
          operationType,
          targetType,
          targetId,
          {
            ...details,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        );
        
        throw error;
      }
    };
  }

  /**
   * 组合权限验证和日志记录
   */
  static withAdminAndLogging<T extends any[], R>(
    operationType: string,
    targetType: string,
    fn: (...args: T) => Promise<R>,
    getTargetId?: (...args: T) => string | null,
    getDetails?: (...args: T) => Record<string, any>
  ) {
    return this.withAdminPermission(
      this.withLogging(operationType, targetType, fn, getTargetId, getDetails)
    );
  }

  /**
   * 组合特定权限验证和日志记录
   */
  static withPermissionAndLogging<T extends any[], R>(
    permission: string,
    operationType: string,
    targetType: string,
    fn: (...args: T) => Promise<R>,
    getTargetId?: (...args: T) => string | null,
    getDetails?: (...args: T) => Record<string, any>
  ) {
    return this.withPermission(
      permission,
      this.withLogging(operationType, targetType, fn, getTargetId, getDetails)
    );
  }
}

/**
 * 权限工具类
 */
export class PermissionUtils {
  /**
   * 检查用户是否拥有任一权限
   */
  static hasAnyPermission(userPermissions: Record<string, boolean>, permissions: string[]): boolean {
    // 超级管理员拥有所有权限
    if (userPermissions.super_admin) return true;
    
    return permissions.some(permission => userPermissions[permission] === true);
  }

  /**
   * 检查用户是否拥有所有权限
   */
  static hasAllPermissions(userPermissions: Record<string, boolean>, permissions: string[]): boolean {
    // 超级管理员拥有所有权限
    if (userPermissions.super_admin) return true;
    
    return permissions.every(permission => userPermissions[permission] === true);
  }

  /**
   * 获取权限的中文描述
   */
  static getPermissionDescription(permission: string): string {
    const descriptions: Record<string, string> = {
      'super_admin': '超级管理员',
      'manage_users': '管理用户',
      'view_users': '查看用户',
      'edit_users': '编辑用户',
      'delete_users': '删除用户',
      'impersonate_users': '模拟用户',
      'manage_admins': '管理管理员',
      'view_admins': '查看管理员',
      'create_admins': '创建管理员',
      'edit_admins': '编辑管理员',
      'delete_admins': '删除管理员',
      'manage_roles': '管理角色',
      'view_roles': '查看角色',
      'create_roles': '创建角色',
      'edit_roles': '编辑角色',
      'delete_roles': '删除角色',
      'manage_system': '系统管理',
      'view_system_logs': '查看系统日志',
      'manage_system_config': '管理系统配置',
      'view_analytics': '查看数据分析',
      'export_data': '导出数据',
      'manage_user_support': '管理客服支持',
      'view_user_support': '查看客服支持'
    };
    
    return descriptions[permission] || permission;
  }

  /**
   * 获取角色的默认权限配置
   */
  static getRolePermissions(roleName: string): Record<string, boolean> {
    const rolePermissions: Record<string, Record<string, boolean>> = {
      'super_admin': {
        'super_admin': true,
        'manage_users': true,
        'manage_admins': true,
        'manage_roles': true,
        'view_analytics': true,
        'manage_system': true
      },
      'admin': {
        'manage_users': true,
        'view_analytics': true,
        'view_system_logs': true
      },
      'support': {
        'view_users': true,
        'manage_user_support': true,
        'view_user_support': true
      }
    };
    
    return rolePermissions[roleName] || {};
  }
}

/**
 * 管理员权限验证器
 */
export class AdminPermissionValidator {
  /**
   * 获取用户权限
   */
  static async getUserPermissions(): Promise<Record<string, boolean>> {
    try {
      const adminUser = await adminAuthService.getCurrentAdminUser();
      if (!adminUser?.role?.permissions) {
        return {};
      }
      return adminUser.role.permissions;
    } catch (error) {
      console.error('获取用户权限失败:', error);
      return {};
    }
  }

  /**
   * 批量验证权限
   */
  static async validateBatch(permissions: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const permission of permissions) {
      try {
        results[permission] = await adminAuthService.hasPermission(permission);
      } catch (error) {
        console.error(`验证权限 ${permission} 失败:`, error);
        results[permission] = false;
      }
    }
    
    return results;
  }

  /**
   * 检查是否可以执行特定操作
   */
  static async canPerformOperation(
    operationName: string,
    requiredPermissions: string[]
  ): Promise<{ canPerform: boolean; missingPermissions: string[] }> {
    try {
      const adminUser = await adminAuthService.getCurrentAdminUser();
      if (!adminUser?.role?.permissions) {
        return { canPerform: false, missingPermissions: requiredPermissions };
      }

      const userPermissions = adminUser.role.permissions;
      
      // 超级管理员可以执行所有操作
      if (userPermissions.super_admin) {
        return { canPerform: true, missingPermissions: [] };
      }

      const missingPermissions = requiredPermissions.filter(
        permission => !userPermissions[permission]
      );

      return {
        canPerform: missingPermissions.length === 0,
        missingPermissions
      };
    } catch (error) {
      console.error(`检查操作权限失败:`, error);
      return { canPerform: false, missingPermissions: requiredPermissions };
    }
  }
}

/**
 * 权限常量
 */
export const ADMIN_PERMISSIONS = {
  // 超级管理员
  SUPER_ADMIN: 'super_admin',
  
  // 用户管理
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  EDIT_USERS: 'edit_users',
  DELETE_USERS: 'delete_users',
  IMPERSONATE_USERS: 'impersonate_users',
  
  // 管理员管理
  MANAGE_ADMINS: 'manage_admins',
  VIEW_ADMINS: 'view_admins',
  CREATE_ADMINS: 'create_admins',
  EDIT_ADMINS: 'edit_admins',
  DELETE_ADMINS: 'delete_admins',
  
  // 角色管理
  MANAGE_ROLES: 'manage_roles',
  VIEW_ROLES: 'view_roles',
  CREATE_ROLES: 'create_roles',
  EDIT_ROLES: 'edit_roles',
  DELETE_ROLES: 'delete_roles',
  
  // 系统管理
  MANAGE_SYSTEM: 'manage_system',
  VIEW_SYSTEM_LOGS: 'view_system_logs',
  MANAGE_SYSTEM_CONFIG: 'manage_system_config',
  
  // 数据分析
  VIEW_ANALYTICS: 'view_analytics',
  EXPORT_DATA: 'export_data',
  
  // 客服支持
  MANAGE_USER_SUPPORT: 'manage_user_support',
  VIEW_USER_SUPPORT: 'view_user_support'
} as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[keyof typeof ADMIN_PERMISSIONS];