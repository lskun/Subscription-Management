import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from './useAdminAuth';
import { AdminPermissionValidator } from '../utils/adminMiddleware';
import { ALL_PERMISSIONS } from '../utils/adminPermissionConstants';

interface UseAdminPermissionsReturn {
  permissions: Record<string, boolean>;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  canPerformOperation: (operation: string, requiredPermissions: string[]) => Promise<{
    canPerform: boolean;
    missingPermissions: string[];
  }>;
  refreshPermissions: () => Promise<void>;
  validatePermissions: (permissions: string[]) => Promise<Record<string, boolean>>;
}

/**
 * 管理员权限管理Hook
 */
export function useAdminPermissions(): UseAdminPermissionsReturn {
  const { isAdmin, adminUser, isLoading: authLoading } = useAdminAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  // 加载用户权限
  const loadPermissions = useCallback(async () => {
    if (!isAdmin || !adminUser) {
      setPermissions({});
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const userPermissions = await AdminPermissionValidator.getUserPermissions();
      setPermissions(userPermissions);
    } catch (error) {
      console.error('加载管理员权限失败:', error);
      setPermissions({});
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, adminUser]);

  // 初始化和用户状态变化时加载权限
  useEffect(() => {
    if (!authLoading) {
      loadPermissions();
    }
  }, [authLoading, loadPermissions]);

  // 检查单个权限
  const hasPermission = useCallback((permission: string): boolean => {
    if (!isAdmin) return false;
    
    // 超级管理员拥有所有权限
    if (permissions.super_admin) return true;
    
    return permissions[permission] === true;
  }, [isAdmin, permissions]);

  // 检查是否拥有任一权限
  const hasAnyPermission = useCallback((requiredPermissions: string[]): boolean => {
    if (!isAdmin) return false;
    
    // 超级管理员拥有所有权限
    if (permissions.super_admin) return true;
    
    return requiredPermissions.some(permission => permissions[permission] === true);
  }, [isAdmin, permissions]);

  // 检查是否拥有所有权限
  const hasAllPermissions = useCallback((requiredPermissions: string[]): boolean => {
    if (!isAdmin) return false;
    
    // 超级管理员拥有所有权限
    if (permissions.super_admin) return true;
    
    return requiredPermissions.every(permission => permissions[permission] === true);
  }, [isAdmin, permissions]);

  // 检查是否可以执行操作
  const canPerformOperation = useCallback(async (
    operation: string,
    requiredPermissions: string[]
  ): Promise<{ canPerform: boolean; missingPermissions: string[] }> => {
    if (!isAdmin) {
      return { canPerform: false, missingPermissions: requiredPermissions };
    }

    try {
      return await AdminPermissionValidator.canPerformOperation(operation, requiredPermissions);
    } catch (error) {
      console.error('检查操作权限失败:', error);
      return { canPerform: false, missingPermissions: requiredPermissions };
    }
  }, [isAdmin]);

  // 刷新权限
  const refreshPermissions = useCallback(async (): Promise<void> => {
    await loadPermissions();
  }, [loadPermissions]);

  // 批量验证权限
  const validatePermissions = useCallback(async (
    permissionsToValidate: string[]
  ): Promise<Record<string, boolean>> => {
    if (!isAdmin) {
      return permissionsToValidate.reduce((acc, permission) => {
        acc[permission] = false;
        return acc;
      }, {} as Record<string, boolean>);
    }

    try {
      return await AdminPermissionValidator.validateBatch(permissionsToValidate);
    } catch (error) {
      console.error('批量验证权限失败:', error);
      return permissionsToValidate.reduce((acc, permission) => {
        acc[permission] = false;
        return acc;
      }, {} as Record<string, boolean>);
    }
  }, [isAdmin]);

  return {
    permissions,
    isLoading: authLoading || isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canPerformOperation,
    refreshPermissions,
    validatePermissions,
  };
}

/**
 * 权限检查Hook - 用于组件级权限控制
 */
export function usePermissionCheck(requiredPermission: string) {
  const { hasPermission, isLoading } = useAdminPermissions();
  
  return {
    hasPermission: hasPermission(requiredPermission),
    isLoading,
  };
}

/**
 * 多权限检查Hook - 检查是否拥有任一权限
 */
export function useAnyPermissionCheck(requiredPermissions: string[]) {
  const { hasAnyPermission, isLoading } = useAdminPermissions();
  
  return {
    hasPermission: hasAnyPermission(requiredPermissions),
    isLoading,
  };
}

/**
 * 全权限检查Hook - 检查是否拥有所有权限
 */
export function useAllPermissionsCheck(requiredPermissions: string[]) {
  const { hasAllPermissions, isLoading } = useAdminPermissions();
  
  return {
    hasPermission: hasAllPermissions(requiredPermissions),
    isLoading,
  };
}

/**
 * 操作权限检查Hook
 */
export function useOperationPermissionCheck(
  operation: string,
  requiredPermissions: string[]
) {
  const { canPerformOperation } = useAdminPermissions();
  const [canPerform, setCanPerform] = useState(false);
  const [missingPermissions, setMissingPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        setIsLoading(true);
        const result = await canPerformOperation(operation, requiredPermissions);
        setCanPerform(result.canPerform);
        setMissingPermissions(result.missingPermissions);
      } catch (error) {
        console.error('检查操作权限失败:', error);
        setCanPerform(false);
        setMissingPermissions(requiredPermissions);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, [operation, requiredPermissions, canPerformOperation]);

  return {
    canPerform,
    missingPermissions,
    isLoading,
  };
}

/**
 * 权限常量Hook - 提供权限常量的便捷访问
 */
export function usePermissionConstants() {
  return {
    ALL_PERMISSIONS,
    // 可以添加其他权限相关的常量
  };
}