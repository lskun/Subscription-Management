import { useState, useEffect, useCallback, useRef } from 'react';
import { adminAuthService, AdminUser } from '../services/adminAuthService';
import { useAuth } from '../contexts/AuthContext';

// 全局状态缓存，避免重复请求
let globalAdminState = {
  isAdmin: false,
  adminUser: null as AdminUser | null,
  isLoading: true,
  lastCheckTime: 0,
  checkPromise: null as Promise<void> | null
};

// 缓存有效期（5分钟）
const CACHE_DURATION = 5 * 60 * 1000;

// 订阅者列表
const subscribers = new Set<() => void>();

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

// 全局检查管理员状态函数
const checkAdminStatusGlobal = async (user: any): Promise<void> => {
  if (!user) {
    globalAdminState.isAdmin = false;
    globalAdminState.adminUser = null;
    globalAdminState.isLoading = false;
    globalAdminState.lastCheckTime = Date.now();
    notifySubscribers();
    return;
  }

  try {
    globalAdminState.isLoading = true;
    notifySubscribers();
    
    // 检查是否为管理员
    const adminStatus = await adminAuthService.isAdmin();
    globalAdminState.isAdmin = adminStatus;

    if (adminStatus) {
      // 获取管理员用户信息
      const adminUserInfo = await adminAuthService.getCurrentAdminUser();
      globalAdminState.adminUser = adminUserInfo;
    } else {
      globalAdminState.adminUser = null;
    }
  } catch (error) {
    console.error('检查管理员状态失败:', error);
    globalAdminState.isAdmin = false;
    globalAdminState.adminUser = null;
  } finally {
    globalAdminState.isLoading = false;
    globalAdminState.lastCheckTime = Date.now();
    globalAdminState.checkPromise = null;
    notifySubscribers();
  }
};

// 通知所有订阅者
const notifySubscribers = () => {
  subscribers.forEach(callback => callback());
};

export function useAdminAuth(): UseAdminAuthReturn {
  const { user } = useAuth();
  const [, forceUpdate] = useState({});
  const userRef = useRef(user);

  // 强制组件重新渲染
  const triggerUpdate = useCallback(() => {
    forceUpdate({});
  }, []);

  // 订阅全局状态变化
  useEffect(() => {
    subscribers.add(triggerUpdate);
    return () => {
      subscribers.delete(triggerUpdate);
    };
  }, [triggerUpdate]);

  // 检查管理员状态（带缓存）
  const checkAdminStatus = useCallback(async () => {
    const now = Date.now();
    const isCacheValid = now - globalAdminState.lastCheckTime < CACHE_DURATION;
    
    // 如果缓存有效且用户没有变化，直接返回
    if (isCacheValid && userRef.current === user && !globalAdminState.isLoading) {
      return;
    }

    // 如果已经有正在进行的检查，等待它完成
    if (globalAdminState.checkPromise) {
      await globalAdminState.checkPromise;
      return;
    }

    // 开始新的检查
    globalAdminState.checkPromise = checkAdminStatusGlobal(user);
    await globalAdminState.checkPromise;
    userRef.current = user;
  }, [user]);

  // 初始化时检查管理员状态
  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  // 检查权限（基于全局缓存的权限信息）
  const hasPermission = useCallback((permission: string): boolean => {
    if (!globalAdminState.adminUser?.role?.permissions) return false;
    
    // 超级管理员拥有所有权限
    if (globalAdminState.adminUser.role.permissions.super_admin) return true;
    
    // 检查具体权限
    return globalAdminState.adminUser.role.permissions[permission] === true;
  }, []);

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
    // 为向后兼容保留，但实际跳转由 AdminGuard 按钮处理
    try {
      const result = await adminAuthService.adminLogin();
      if (result.success) {
        await checkAdminStatus();
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
        globalAdminState.isAdmin = false;
        globalAdminState.adminUser = null;
        globalAdminState.lastCheckTime = Date.now();
        notifySubscribers();
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
    isAdmin: globalAdminState.isAdmin,
    adminUser: globalAdminState.adminUser,
    isLoading: globalAdminState.isLoading,
    hasPermission,
    login,
    logout,
    checkPermission,
    refreshAdminStatus
  };
}