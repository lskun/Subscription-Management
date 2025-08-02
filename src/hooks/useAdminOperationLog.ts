import { useCallback } from 'react';
import { adminAuthService, AdminOperationLog } from '../services/adminAuthService';
import { useAdminAuth } from './useAdminAuth';

interface UseAdminOperationLogReturn {
  logOperation: (
    operationType: string,
    targetType: string,
    targetId?: string | null,
    details?: Record<string, any>
  ) => Promise<void>;
  getOperationLogs: (
    page?: number,
    limit?: number,
    filters?: {
      adminUserId?: string;
      operationType?: string;
      targetType?: string;
      startDate?: string;
      endDate?: string;
    }
  ) => Promise<{ data: AdminOperationLog[]; total: number; error?: string }>;
}

export function useAdminOperationLog(): UseAdminOperationLogReturn {
  const { isAdmin } = useAdminAuth();

  // 记录操作日志
  const logOperation = useCallback(async (
    operationType: string,
    targetType: string,
    targetId?: string | null,
    details: Record<string, any> = {}
  ): Promise<void> => {
    if (!isAdmin) {
      console.warn('非管理员用户尝试记录操作日志');
      return;
    }

    try {
      await adminAuthService.logOperation(
        operationType,
        targetType,
        targetId || null,
        {
          ...details,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          url: window.location.href
        }
      );
    } catch (error) {
      console.error('记录管理员操作日志失败:', error);
    }
  }, [isAdmin]);

  // 获取操作日志
  const getOperationLogs = useCallback(async (
    page: number = 1,
    limit: number = 50,
    filters?: {
      adminUserId?: string;
      operationType?: string;
      targetType?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ data: AdminOperationLog[]; total: number; error?: string }> => {
    if (!isAdmin) {
      return { data: [], total: 0, error: '无管理员权限' };
    }

    try {
      return await adminAuthService.getOperationLogs(page, limit, filters);
    } catch (error) {
      console.error('获取管理员操作日志失败:', error);
      return { data: [], total: 0, error: '获取日志失败' };
    }
  }, [isAdmin]);

  return {
    logOperation,
    getOperationLogs
  };
}

// 操作类型常量
export const ADMIN_OPERATION_TYPES = {
  // 用户管理
  USER_VIEW: 'user_view',
  USER_EDIT: 'user_edit',
  USER_DELETE: 'user_delete',
  USER_SUSPEND: 'user_suspend',
  USER_ACTIVATE: 'user_activate',
  USER_IMPERSONATE: 'user_impersonate',
  
  // 订阅管理
  SUBSCRIPTION_VIEW: 'subscription_view',
  SUBSCRIPTION_EDIT: 'subscription_edit',
  SUBSCRIPTION_DELETE: 'subscription_delete',
  
  // 系统管理
  SYSTEM_CONFIG_CHANGE: 'system_config_change',
  ADMIN_LOGIN: 'admin_login',
  ADMIN_LOGOUT: 'admin_logout',
  
  // 权限管理
  ROLE_CREATE: 'role_create',
  ROLE_EDIT: 'role_edit',
  ROLE_DELETE: 'role_delete',
  ADMIN_CREATE: 'admin_create',
  ADMIN_EDIT: 'admin_edit',
  ADMIN_DELETE: 'admin_delete',
  
  // 数据操作
  DATA_EXPORT: 'data_export',
  DATA_IMPORT: 'data_import',
  DATA_BACKUP: 'data_backup',
  DATA_RESTORE: 'data_restore'
} as const;

// 目标类型常量
export const ADMIN_TARGET_TYPES = {
  USER: 'user',
  SUBSCRIPTION: 'subscription',
  PAYMENT: 'payment',
  CATEGORY: 'category',
  PAYMENT_METHOD: 'payment_method',
  ADMIN_USER: 'admin_user',
  ADMIN_ROLE: 'admin_role',
  SYSTEM: 'system'
} as const;