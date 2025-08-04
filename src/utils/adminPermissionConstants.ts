/**
 * 管理员权限常量定义
 */

// 基础权限
export const BASE_PERMISSIONS = {
  SUPER_ADMIN: 'super_admin',
} as const;

// 用户管理权限
export const USER_PERMISSIONS = {
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  CREATE_USERS: 'create_users',
  EDIT_USERS: 'edit_users',
  DELETE_USERS: 'delete_users',
  SUSPEND_USERS: 'suspend_users',
  ACTIVATE_USERS: 'activate_users',
  IMPERSONATE_USERS: 'impersonate_users',
  VIEW_USER_DETAILS: 'view_user_details',
  EXPORT_USER_DATA: 'export_user_data',
} as const;

// 管理员管理权限
export const ADMIN_PERMISSIONS = {
  MANAGE_ADMINS: 'manage_admins',
  VIEW_ADMINS: 'view_admins',
  CREATE_ADMINS: 'create_admins',
  EDIT_ADMINS: 'edit_admins',
  DELETE_ADMINS: 'delete_admins',
  ASSIGN_ADMIN_ROLES: 'assign_admin_roles',
  VIEW_LOGS: 'view_logs',
  VIEW_SYSTEM: 'view_system',
  MANAGE_SYSTEM: 'manage_system',
} as const;

// 角色管理权限
export const ROLE_PERMISSIONS = {
  MANAGE_ROLES: 'manage_roles',
  VIEW_ROLES: 'view_roles',
  CREATE_ROLES: 'create_roles',
  EDIT_ROLES: 'edit_roles',
  DELETE_ROLES: 'delete_roles',
  ASSIGN_PERMISSIONS: 'assign_permissions',
} as const;

// 系统管理权限
export const SYSTEM_PERMISSIONS = {
  MANAGE_SYSTEM: 'manage_system',
  VIEW_SYSTEM_LOGS: 'view_system_logs',
  MANAGE_SYSTEM_CONFIG: 'manage_system_config',
  SYSTEM_BACKUP: 'system_backup',
  SYSTEM_RESTORE: 'system_restore',
  SYSTEM_MAINTENANCE: 'system_maintenance',
} as const;

// 数据分析权限
export const ANALYTICS_PERMISSIONS = {
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_USER_ANALYTICS: 'view_user_analytics',
  VIEW_SYSTEM_ANALYTICS: 'view_system_analytics',
  EXPORT_ANALYTICS: 'export_analytics',
  MANAGE_REPORTS: 'manage_reports',
} as const;

// 数据管理权限
export const DATA_PERMISSIONS = {
  EXPORT_DATA: 'export_data',
  IMPORT_DATA: 'import_data',
  DELETE_DATA: 'delete_data',
  BACKUP_DATA: 'backup_data',
  RESTORE_DATA: 'restore_data',
} as const;

// 客服支持权限
export const SUPPORT_PERMISSIONS = {
  MANAGE_USER_SUPPORT: 'manage_user_support',
  VIEW_USER_SUPPORT: 'view_user_support',
  CREATE_SUPPORT_TICKETS: 'create_support_tickets',
  RESOLVE_SUPPORT_TICKETS: 'resolve_support_tickets',
  VIEW_SUPPORT_HISTORY: 'view_support_history',
} as const;

// 订阅管理权限
export const SUBSCRIPTION_PERMISSIONS = {
  MANAGE_SUBSCRIPTIONS: 'manage_subscriptions',
  VIEW_SUBSCRIPTIONS: 'view_subscriptions',
  EDIT_SUBSCRIPTIONS: 'edit_subscriptions',
  DELETE_SUBSCRIPTIONS: 'delete_subscriptions',
  MANAGE_SUBSCRIPTION_PLANS: 'manage_subscription_plans',
} as const;

// 财务管理权限
export const FINANCIAL_PERMISSIONS = {
  VIEW_FINANCIAL_DATA: 'view_financial_data',
  MANAGE_PAYMENTS: 'manage_payments',
  VIEW_REVENUE_REPORTS: 'view_revenue_reports',
  MANAGE_BILLING: 'manage_billing',
  PROCESS_REFUNDS: 'process_refunds',
} as const;

// 所有权限的联合类型
export const ALL_PERMISSIONS = {
  ...BASE_PERMISSIONS,
  ...USER_PERMISSIONS,
  ...ADMIN_PERMISSIONS,
  ...ROLE_PERMISSIONS,
  ...SYSTEM_PERMISSIONS,
  ...ANALYTICS_PERMISSIONS,
  ...DATA_PERMISSIONS,
  ...SUPPORT_PERMISSIONS,
  ...SUBSCRIPTION_PERMISSIONS,
  ...FINANCIAL_PERMISSIONS,
} as const;

// 权限类型定义
export type Permission = typeof ALL_PERMISSIONS[keyof typeof ALL_PERMISSIONS];

// 权限分组
export const PERMISSION_GROUPS = {
  BASE: Object.values(BASE_PERMISSIONS),
  USER: Object.values(USER_PERMISSIONS),
  ADMIN: Object.values(ADMIN_PERMISSIONS),
  ROLE: Object.values(ROLE_PERMISSIONS),
  SYSTEM: Object.values(SYSTEM_PERMISSIONS),
  ANALYTICS: Object.values(ANALYTICS_PERMISSIONS),
  DATA: Object.values(DATA_PERMISSIONS),
  SUPPORT: Object.values(SUPPORT_PERMISSIONS),
  SUBSCRIPTION: Object.values(SUBSCRIPTION_PERMISSIONS),
  FINANCIAL: Object.values(FINANCIAL_PERMISSIONS),
} as const;

// 权限描述映射
export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  // 基础权限
  [BASE_PERMISSIONS.SUPER_ADMIN]: '超级管理员',

  // 用户管理权限
  [USER_PERMISSIONS.MANAGE_USERS]: '管理用户',
  [USER_PERMISSIONS.VIEW_USERS]: '查看用户',
  [USER_PERMISSIONS.CREATE_USERS]: '创建用户',
  [USER_PERMISSIONS.EDIT_USERS]: '编辑用户',
  [USER_PERMISSIONS.DELETE_USERS]: '删除用户',
  [USER_PERMISSIONS.SUSPEND_USERS]: '暂停用户',
  [USER_PERMISSIONS.ACTIVATE_USERS]: '激活用户',
  [USER_PERMISSIONS.IMPERSONATE_USERS]: '模拟用户',
  [USER_PERMISSIONS.VIEW_USER_DETAILS]: '查看用户详情',
  [USER_PERMISSIONS.EXPORT_USER_DATA]: '导出用户数据',

  // 管理员管理权限
  [ADMIN_PERMISSIONS.MANAGE_ADMINS]: '管理管理员',
  [ADMIN_PERMISSIONS.VIEW_ADMINS]: '查看管理员',
  [ADMIN_PERMISSIONS.CREATE_ADMINS]: '创建管理员',
  [ADMIN_PERMISSIONS.EDIT_ADMINS]: '编辑管理员',
  [ADMIN_PERMISSIONS.DELETE_ADMINS]: '删除管理员',
  [ADMIN_PERMISSIONS.ASSIGN_ADMIN_ROLES]: '分配管理员角色',
  [ADMIN_PERMISSIONS.VIEW_LOGS]: '查看操作日志',
  [ADMIN_PERMISSIONS.VIEW_SYSTEM]: '查看系统监控',
  //[ADMIN_PERMISSIONS.MANAGE_SYSTEM]: '管理系统设置',

  // 角色管理权限
  [ROLE_PERMISSIONS.MANAGE_ROLES]: '管理角色',
  [ROLE_PERMISSIONS.VIEW_ROLES]: '查看角色',
  [ROLE_PERMISSIONS.CREATE_ROLES]: '创建角色',
  [ROLE_PERMISSIONS.EDIT_ROLES]: '编辑角色',
  [ROLE_PERMISSIONS.DELETE_ROLES]: '删除角色',
  [ROLE_PERMISSIONS.ASSIGN_PERMISSIONS]: '分配权限',

  // 系统管理权限
  [SYSTEM_PERMISSIONS.MANAGE_SYSTEM]: '系统管理',
  [SYSTEM_PERMISSIONS.VIEW_SYSTEM_LOGS]: '查看系统日志',
  [SYSTEM_PERMISSIONS.MANAGE_SYSTEM_CONFIG]: '管理系统配置',
  [SYSTEM_PERMISSIONS.SYSTEM_BACKUP]: '系统备份',
  [SYSTEM_PERMISSIONS.SYSTEM_RESTORE]: '系统恢复',
  [SYSTEM_PERMISSIONS.SYSTEM_MAINTENANCE]: '系统维护',

  // 数据分析权限
  [ANALYTICS_PERMISSIONS.VIEW_ANALYTICS]: '查看数据分析',
  [ANALYTICS_PERMISSIONS.VIEW_USER_ANALYTICS]: '查看用户分析',
  [ANALYTICS_PERMISSIONS.VIEW_SYSTEM_ANALYTICS]: '查看系统分析',
  [ANALYTICS_PERMISSIONS.EXPORT_ANALYTICS]: '导出分析数据',
  [ANALYTICS_PERMISSIONS.MANAGE_REPORTS]: '管理报告',

  // 数据管理权限
  [DATA_PERMISSIONS.EXPORT_DATA]: '导出数据',
  [DATA_PERMISSIONS.IMPORT_DATA]: '导入数据',
  [DATA_PERMISSIONS.DELETE_DATA]: '删除数据',
  [DATA_PERMISSIONS.BACKUP_DATA]: '备份数据',
  [DATA_PERMISSIONS.RESTORE_DATA]: '恢复数据',

  // 客服支持权限
  [SUPPORT_PERMISSIONS.MANAGE_USER_SUPPORT]: '管理客服支持',
  [SUPPORT_PERMISSIONS.VIEW_USER_SUPPORT]: '查看客服支持',
  [SUPPORT_PERMISSIONS.CREATE_SUPPORT_TICKETS]: '创建支持工单',
  [SUPPORT_PERMISSIONS.RESOLVE_SUPPORT_TICKETS]: '解决支持工单',
  [SUPPORT_PERMISSIONS.VIEW_SUPPORT_HISTORY]: '查看支持历史',

  // 订阅管理权限
  [SUBSCRIPTION_PERMISSIONS.MANAGE_SUBSCRIPTIONS]: '管理订阅',
  [SUBSCRIPTION_PERMISSIONS.VIEW_SUBSCRIPTIONS]: '查看订阅',
  [SUBSCRIPTION_PERMISSIONS.EDIT_SUBSCRIPTIONS]: '编辑订阅',
  [SUBSCRIPTION_PERMISSIONS.DELETE_SUBSCRIPTIONS]: '删除订阅',
  [SUBSCRIPTION_PERMISSIONS.MANAGE_SUBSCRIPTION_PLANS]: '管理订阅计划',

  // 财务管理权限
  [FINANCIAL_PERMISSIONS.VIEW_FINANCIAL_DATA]: '查看财务数据',
  [FINANCIAL_PERMISSIONS.MANAGE_PAYMENTS]: '管理支付',
  [FINANCIAL_PERMISSIONS.VIEW_REVENUE_REPORTS]: '查看收入报告',
  [FINANCIAL_PERMISSIONS.MANAGE_BILLING]: '管理账单',
  [FINANCIAL_PERMISSIONS.PROCESS_REFUNDS]: '处理退款',
};

// 权限依赖关系
export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  [USER_PERMISSIONS.DELETE_USERS]: [USER_PERMISSIONS.MANAGE_USERS],
  [USER_PERMISSIONS.EDIT_USERS]: [USER_PERMISSIONS.VIEW_USERS],
  [USER_PERMISSIONS.SUSPEND_USERS]: [USER_PERMISSIONS.MANAGE_USERS],
  [USER_PERMISSIONS.ACTIVATE_USERS]: [USER_PERMISSIONS.MANAGE_USERS],
  [USER_PERMISSIONS.IMPERSONATE_USERS]: [USER_PERMISSIONS.MANAGE_USERS],
  
  [ADMIN_PERMISSIONS.CREATE_ADMINS]: [ADMIN_PERMISSIONS.MANAGE_ADMINS],
  [ADMIN_PERMISSIONS.EDIT_ADMINS]: [ADMIN_PERMISSIONS.MANAGE_ADMINS],
  [ADMIN_PERMISSIONS.DELETE_ADMINS]: [ADMIN_PERMISSIONS.MANAGE_ADMINS],
  [ADMIN_PERMISSIONS.ASSIGN_ADMIN_ROLES]: [ADMIN_PERMISSIONS.MANAGE_ADMINS],
  
  [ROLE_PERMISSIONS.CREATE_ROLES]: [ROLE_PERMISSIONS.MANAGE_ROLES],
  [ROLE_PERMISSIONS.EDIT_ROLES]: [ROLE_PERMISSIONS.MANAGE_ROLES],
  [ROLE_PERMISSIONS.DELETE_ROLES]: [ROLE_PERMISSIONS.MANAGE_ROLES],
  [ROLE_PERMISSIONS.ASSIGN_PERMISSIONS]: [ROLE_PERMISSIONS.MANAGE_ROLES],
};

// 危险权限列表（需要特别确认的权限）
export const DANGEROUS_PERMISSIONS = [
  BASE_PERMISSIONS.SUPER_ADMIN,
  USER_PERMISSIONS.DELETE_USERS,
  ADMIN_PERMISSIONS.DELETE_ADMINS,
  ROLE_PERMISSIONS.DELETE_ROLES,
  SYSTEM_PERMISSIONS.SYSTEM_RESTORE,
  DATA_PERMISSIONS.DELETE_DATA,
  DATA_PERMISSIONS.RESTORE_DATA,
];

// 预定义角色配置
export const PREDEFINED_ROLES = {
  SUPER_ADMIN: {
    name: 'super_admin',
    displayName: '超级管理员',
    description: '拥有系统所有权限的超级管理员',
    permissions: {
      [BASE_PERMISSIONS.SUPER_ADMIN]: true,
    },
  },
  ADMIN: {
    name: 'admin',
    displayName: '管理员',
    description: '拥有用户管理和数据分析权限的管理员',
    permissions: {
      [USER_PERMISSIONS.MANAGE_USERS]: true,
      [USER_PERMISSIONS.VIEW_USERS]: true,
      [USER_PERMISSIONS.EDIT_USERS]: true,
      [ANALYTICS_PERMISSIONS.VIEW_ANALYTICS]: true,
      [SYSTEM_PERMISSIONS.VIEW_SYSTEM_LOGS]: true,
      [SUBSCRIPTION_PERMISSIONS.VIEW_SUBSCRIPTIONS]: true,
      [SUBSCRIPTION_PERMISSIONS.MANAGE_SUBSCRIPTIONS]: true,
    },
  },
  SUPPORT: {
    name: 'support',
    displayName: '客服人员',
    description: '负责用户支持和客服工作的角色',
    permissions: {
      [USER_PERMISSIONS.VIEW_USERS]: true,
      [USER_PERMISSIONS.VIEW_USER_DETAILS]: true,
      [SUPPORT_PERMISSIONS.MANAGE_USER_SUPPORT]: true,
      [SUPPORT_PERMISSIONS.VIEW_USER_SUPPORT]: true,
      [SUPPORT_PERMISSIONS.CREATE_SUPPORT_TICKETS]: true,
      [SUPPORT_PERMISSIONS.RESOLVE_SUPPORT_TICKETS]: true,
      [SUPPORT_PERMISSIONS.VIEW_SUPPORT_HISTORY]: true,
      [SUBSCRIPTION_PERMISSIONS.VIEW_SUBSCRIPTIONS]: true,
    },
  },
  ANALYST: {
    name: 'analyst',
    displayName: '数据分析师',
    description: '负责数据分析和报告的角色',
    permissions: {
      [ANALYTICS_PERMISSIONS.VIEW_ANALYTICS]: true,
      [ANALYTICS_PERMISSIONS.VIEW_USER_ANALYTICS]: true,
      [ANALYTICS_PERMISSIONS.VIEW_SYSTEM_ANALYTICS]: true,
      [ANALYTICS_PERMISSIONS.EXPORT_ANALYTICS]: true,
      [ANALYTICS_PERMISSIONS.MANAGE_REPORTS]: true,
      [DATA_PERMISSIONS.EXPORT_DATA]: true,
      [FINANCIAL_PERMISSIONS.VIEW_FINANCIAL_DATA]: true,
      [FINANCIAL_PERMISSIONS.VIEW_REVENUE_REPORTS]: true,
    },
  },
} as const;

/**
 * 权限工具函数
 */
export class PermissionHelper {
  /**
   * 获取权限的显示名称
   */
  static getPermissionDisplayName(permission: string): string {
    return PERMISSION_DESCRIPTIONS[permission] || permission;
  }

  /**
   * 检查权限是否为危险权限
   */
  static isDangerousPermission(permission: string): boolean {
    return DANGEROUS_PERMISSIONS.includes(permission as any);
  }

  /**
   * 获取权限的依赖权限
   */
  static getPermissionDependencies(permission: string): string[] {
    return PERMISSION_DEPENDENCIES[permission] || [];
  }

  /**
   * 验证权限组合的有效性
   */
  static validatePermissions(permissions: Record<string, boolean>): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查权限依赖
    for (const [permission, enabled] of Object.entries(permissions)) {
      if (enabled) {
        const dependencies = this.getPermissionDependencies(permission);
        for (const dependency of dependencies) {
          if (!permissions[dependency]) {
            errors.push(`权限 ${this.getPermissionDisplayName(permission)} 需要依赖权限 ${this.getPermissionDisplayName(dependency)}`);
          }
        }

        // 检查危险权限
        if (this.isDangerousPermission(permission)) {
          warnings.push(`权限 ${this.getPermissionDisplayName(permission)} 是危险权限，请谨慎使用`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 获取角色的权限列表
   */
  static getRolePermissions(roleName: string): Record<string, boolean> {
    const role = Object.values(PREDEFINED_ROLES).find(r => r.name === roleName);
    return role?.permissions || {};
  }

  /**
   * 获取所有可用权限
   */
  static getAllPermissions(): string[] {
    return Object.values(ALL_PERMISSIONS);
  }

  /**
   * 按分组获取权限
   */
  static getPermissionsByGroup(group: keyof typeof PERMISSION_GROUPS): string[] {
    return PERMISSION_GROUPS[group] as string[];
  }
}