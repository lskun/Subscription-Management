import { adminAuthService } from '../services/adminAuthService';
import { ADMIN_PERMISSIONS } from './adminMiddleware';

/**
 * 管理员权限验证工具函数
 */
export class AdminPermissionUtils {
  /**
   * 检查当前用户是否为管理员
   */
  static async isCurrentUserAdmin(): Promise<boolean> {
    try {
      return await adminAuthService.isAdmin();
    } catch (error) {
      console.error('检查管理员状态失败:', error);
      return false;
    }
  }

  /**
   * 检查当前用户是否有特定权限
   */
  static async hasCurrentUserPermission(permission: string): Promise<boolean> {
    try {
      return await adminAuthService.hasPermission(permission);
    } catch (error) {
      console.error('检查权限失败:', error);
      return false;
    }
  }

  /**
   * 获取当前管理员用户信息
   */
  static async getCurrentAdminUser() {
    try {
      return await adminAuthService.getCurrentAdminUser();
    } catch (error) {
      console.error('获取管理员用户信息失败:', error);
      return null;
    }
  }

  /**
   * 批量检查权限
   */
  static async checkMultiplePermissions(permissions: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const permission of permissions) {
      results[permission] = await this.hasCurrentUserPermission(permission);
    }
    
    return results;
  }

  /**
   * 检查是否为超级管理员
   */
  static async isSuperAdmin(): Promise<boolean> {
    return await this.hasCurrentUserPermission(ADMIN_PERMISSIONS.SUPER_ADMIN);
  }

  /**
   * 获取用户权限列表
   */
  static async getUserPermissions(): Promise<string[]> {
    try {
      const adminUser = await this.getCurrentAdminUser();
      if (!adminUser?.role?.permissions) {
        return [];
      }

      return Object.entries(adminUser.role.permissions)
        .filter(([_, value]) => value === true)
        .map(([permission]) => permission);
    } catch (error) {
      console.error('获取用户权限列表失败:', error);
      return [];
    }
  }

  /**
   * 权限描述映射
   */
  static getPermissionDescription(permission: string): string {
    const descriptions: Record<string, string> = {
      [ADMIN_PERMISSIONS.SUPER_ADMIN]: '超级管理员权限',
      [ADMIN_PERMISSIONS.MANAGE_USERS]: '管理用户',
      [ADMIN_PERMISSIONS.VIEW_USERS]: '查看用户',
      [ADMIN_PERMISSIONS.EDIT_USERS]: '编辑用户',
      [ADMIN_PERMISSIONS.DELETE_USERS]: '删除用户',
      [ADMIN_PERMISSIONS.IMPERSONATE_USERS]: '模拟用户',
      [ADMIN_PERMISSIONS.MANAGE_ADMINS]: '管理管理员',
      [ADMIN_PERMISSIONS.VIEW_ADMINS]: '查看管理员',
      [ADMIN_PERMISSIONS.CREATE_ADMINS]: '创建管理员',
      [ADMIN_PERMISSIONS.EDIT_ADMINS]: '编辑管理员',
      [ADMIN_PERMISSIONS.DELETE_ADMINS]: '删除管理员',
      [ADMIN_PERMISSIONS.MANAGE_ROLES]: '管理角色',
      [ADMIN_PERMISSIONS.VIEW_ROLES]: '查看角色',
      [ADMIN_PERMISSIONS.CREATE_ROLES]: '创建角色',
      [ADMIN_PERMISSIONS.EDIT_ROLES]: '编辑角色',
      [ADMIN_PERMISSIONS.DELETE_ROLES]: '删除角色',
      [ADMIN_PERMISSIONS.MANAGE_SYSTEM]: '系统管理',
      [ADMIN_PERMISSIONS.VIEW_SYSTEM_LOGS]: '查看系统日志',
      [ADMIN_PERMISSIONS.MANAGE_SYSTEM_CONFIG]: '管理系统配置',
      [ADMIN_PERMISSIONS.VIEW_ANALYTICS]: '查看数据分析',
      [ADMIN_PERMISSIONS.EXPORT_DATA]: '导出数据',
      [ADMIN_PERMISSIONS.MANAGE_USER_SUPPORT]: '管理用户支持',
      [ADMIN_PERMISSIONS.VIEW_USER_SUPPORT]: '查看用户支持'
    };

    return descriptions[permission] || permission;
  }

  /**
   * 角色描述映射
   */
  static getRoleDescription(roleName: string): string {
    const descriptions: Record<string, string> = {
      'super_admin': '超级管理员 - 拥有所有权限',
      'admin': '普通管理员 - 可以管理用户和查看分析',
      'support': '客服人员 - 可以查看用户信息和提供支持'
    };

    return descriptions[roleName] || roleName;
  }

  /**
   * 验证权限并抛出错误（用于API中间件）
   */
  static async requirePermission(permission: string): Promise<void> {
    const hasPermission = await this.hasCurrentUserPermission(permission);
    if (!hasPermission) {
      throw new Error(`需要权限: ${this.getPermissionDescription(permission)}`);
    }
  }

  /**
   * 验证管理员身份并抛出错误
   */
  static async requireAdmin(): Promise<void> {
    const isAdmin = await this.isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('需要管理员权限');
    }
  }
}

/**
 * 权限检查装饰器（用于类方法）
 */
export function RequirePermission(permission: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      await AdminPermissionUtils.requirePermission(permission);
      return method.apply(this, args);
    };
  };
}

/**
 * 管理员检查装饰器
 */
export function RequireAdmin() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      await AdminPermissionUtils.requireAdmin();
      return method.apply(this, args);
    };
  };
}