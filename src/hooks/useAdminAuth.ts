import { useState, useEffect, useCallback } from 'react';
import { adminAuthService, AdminUser } from '../services/adminAuthService';
import { useAuth } from '../contexts/AuthContext';

interface UseAdminAuthReturn {
  isAdmin: boolean;
  adminUser: AdminUser | null;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  login: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<{ success: boolean; error?: string }>;
  checkPermission: (permission: string) => Promise<boolean>;
  refreshAdminStatus: () => Promise<void>;
}

export function useAdminAuth(): UseAdminAuthReturn {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 检查管理员状态
  const checkAdminStatus = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      setAdminUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // 检查是否为管理员
      const adminStatus = await adminAuthService.isAdmin();
      setIsAdmin(adminStatus);

      if (adminStatus) {
        // 获取管理员用户信息
        const adminUserInfo = await adminAuthService.getCurrentAdminUser();
        setAdminUser(adminUserInfo);
      } else {
        setAdminUser(null);
      }
    } catch (error) {
      console.error('检查管理员状态失败:', error);
      setIsAdmin(false);
      setAdminUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // 初始化时检查管理员状态
  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  // 检查权限（基于本地缓存的权限信息）
  const hasPermission = useCallback((permission: string): boolean => {
    if (!adminUser?.role?.permissions) return false;
    
    // 超级管理员拥有所有权限
    if (adminUser.role.permissions.super_admin) return true;
    
    // 检查具体权限
    return adminUser.role.permissions[permission] === true;
  }, [adminUser]);

  // 异步检查权限（从服务器验证）
  const checkPermission = useCallback(async (permission: string): Promise<boolean> => {
    try {
      return await adminAuthService.hasPermission(permission);
    } catch (error) {
      console.error('检查权限失败:', error);
      return false;
    }
  }, []);

  // 管理员登录
  const login = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await adminAuthService.adminLogin();
      if (result.success) {
        await checkAdminStatus(); // 刷新管理员状态
      }
      return result;
    } catch (error) {
      console.error('管理员登录失败:', error);
      return { success: false, error: '登录失败' };
    }
  }, [checkAdminStatus]);

  // 管理员登出
  const logout = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await adminAuthService.adminLogout();
      if (result.success) {
        setIsAdmin(false);
        setAdminUser(null);
      }
      return result;
    } catch (error) {
      console.error('管理员登出失败:', error);
      return { success: false, error: '登出失败' };
    }
  }, []);

  // 刷新管理员状态
  const refreshAdminStatus = useCallback(async (): Promise<void> => {
    await checkAdminStatus();
  }, [checkAdminStatus]);

  return {
    isAdmin,
    adminUser,
    isLoading,
    hasPermission,
    login,
    logout,
    checkPermission,
    refreshAdminStatus
  };
}