import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

/**
 * 管理员权限缓存接口
 */
interface AdminPermissionCache {
  isAdmin: boolean;
  permissions: Record<string, boolean>;
  adminUser: AdminUser | null;
  timestamp: number;
}

/**
 * 缓存配置
 */
const CACHE_CONFIG = {
  PERMISSION_CACHE_DURATION: 5 * 60 * 1000, // 5分钟
  ADMIN_USER_CACHE_DURATION: 10 * 60 * 1000, // 10分钟
} as const;

export interface AdminRole {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  user_id: string;
  role_id: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  role?: AdminRole;
  user?: User;
}

export interface AdminSession {
  id: string;
  admin_user_id: string;
  session_token: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminOperationLog {
  id: string;
  admin_user_id: string;
  operation_type: string;
  target_type: string;
  target_id?: string;
  operation_details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

class AdminAuthService {
  private permissionCache = new Map<string, AdminPermissionCache>();
  private adminUserCache: { data: AdminUser | null; timestamp: number } | null = null;

  /**
   * 清除权限缓存
   */
  private clearPermissionCache(userId?: string): void {
    if (userId) {
      this.permissionCache.delete(userId);
    } else {
      this.permissionCache.clear();
    }
    this.adminUserCache = null;
  }

  /**
   * 获取缓存的权限信息
   */
  private getCachedPermissions(userId: string): AdminPermissionCache | null {
    const cached = this.permissionCache.get(userId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > CACHE_CONFIG.PERMISSION_CACHE_DURATION) {
      this.permissionCache.delete(userId);
      return null;
    }

    return cached;
  }

  /**
   * 设置权限缓存
   */
  private setCachedPermissions(userId: string, cache: Omit<AdminPermissionCache, 'timestamp'>): void {
    this.permissionCache.set(userId, {
      ...cache,
      timestamp: Date.now()
    });
  }

  /**
   * 获取完整的管理员信息（包含权限）
   */
  private async getFullAdminInfo(userId: string): Promise<AdminPermissionCache> {
    // 检查缓存
    const cached = this.getCachedPermissions(userId);
    if (cached) {
      return cached;
    }

    try {
      // 一次性获取管理员信息和角色权限
      const { data: adminData, error } = await supabase
        .from('admin_users')
        .select(`
          *,
          role:admin_roles(*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error || !adminData) {
        const result = {
          isAdmin: false,
          permissions: {},
          adminUser: null,  
          timestamp: Date.now()
        };
        this.setCachedPermissions(userId, result);
        return result;
      }

      // 解析角色权限
      const rolePermissions = adminData.role?.permissions || {};
      const isAdmin = true;

      const result = {
        isAdmin,
        permissions: rolePermissions,
        adminUser: adminData,
        timestamp: Date.now()
      };

      this.setCachedPermissions(userId, result);
      return result;
    } catch (error) {
      console.error('获取管理员信息失败:', error);
      const result = {
        isAdmin: false,
        permissions: {},
        adminUser: null,
        timestamp: Date.now()
      };
      this.setCachedPermissions(userId, result);
      return result;
    }
  }

  /**
   * 检查当前用户是否为管理员
   */
  async isAdmin(): Promise<boolean> {
    try {
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      if (!user) return false;

      const adminInfo = await this.getFullAdminInfo(user.id);
      return adminInfo.isAdmin;
    } catch (error) {
      console.error('检查管理员状态异常:', error);
      return false;
    }
  }

  /**
   * 检查当前用户是否有特定权限
   */
  async hasPermission(permission: string): Promise<boolean> {
    try {
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      if (!user) return false;

      const adminInfo = await this.getFullAdminInfo(user.id);
      
      // 超级管理员拥有所有权限
      if (adminInfo.permissions.super_admin) {
        return true;
      }

      return adminInfo.permissions[permission] === true;
    } catch (error) {
      console.error('检查管理员权限异常:', error);
      return false;
    }
  }

  /**
   * 批量检查权限
   */
  async hasPermissions(permissions: string[]): Promise<Record<string, boolean>> {
    try {
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      if (!user) {
        return permissions.reduce((acc, perm) => ({ ...acc, [perm]: false }), {});
      }

      const adminInfo = await this.getFullAdminInfo(user.id);
      
      // 超级管理员拥有所有权限
      if (adminInfo.permissions.super_admin) {
        return permissions.reduce((acc, perm) => ({ ...acc, [perm]: true }), {});
      }

      return permissions.reduce((acc, perm) => ({
        ...acc,
        [perm]: adminInfo.permissions[perm] === true
      }), {});
    } catch (error) {
      console.error('批量检查权限异常:', error);
      return permissions.reduce((acc, perm) => ({ ...acc, [perm]: false }), {});
    }
  }

  /**
   * 获取当前管理员用户信息
   */
  async getCurrentAdminUser(): Promise<AdminUser | null> {
    try {
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      if (!user) return null;

      const adminInfo = await this.getFullAdminInfo(user.id);
      return adminInfo.adminUser;
    } catch (error) {
      console.error('获取管理员用户信息异常:', error);
      return null;
    }
  }

  /**
   * 刷新权限缓存
   */
  async refreshPermissionCache(): Promise<void> {
    try {
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      if (user) {
        this.clearPermissionCache(user.id);
        // 重新获取权限信息
        await this.getFullAdminInfo(user.id);
      }
    } catch (error) {
      console.error('刷新权限缓存失败:', error);
    }
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.clearPermissionCache();
  }

  /**
   * 管理员登录（创建管理员会话）
   */
  async adminLogin(): Promise<{ success: boolean; session?: AdminSession; error?: string }> {
    try {
      const { UserCacheService } = await import('./userCacheService');
      const user = await UserCacheService.getCurrentUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 检查是否为管理员
      const isAdmin = await this.isAdmin();
      if (!isAdmin) {
        return { success: false, error: '无管理员权限' };
      }

      // 获取管理员用户信息
      const adminUser = await this.getCurrentAdminUser();
      if (!adminUser) {
        return { success: false, error: '管理员用户不存在' };
      }

      // 生成会话token
      const sessionToken = this.generateSessionToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 8); // 8小时有效期

      // 创建管理员会话
      const { data: session, error } = await supabase
        .from('admin_sessions')
        .insert({
          admin_user_id: adminUser.id,
          session_token: sessionToken,
          expires_at: expiresAt.toISOString(),
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('创建管理员会话失败:', error);
        return { success: false, error: '创建会话失败' };
      }

      // 记录登录日志
      await this.logOperation('admin_login', 'system', null, {
        session_id: session.id,
        login_time: new Date().toISOString()
      });

      return { success: true, session };
    } catch (error) {
      console.error('管理员登录异常:', error);
      return { success: false, error: '登录异常' };
    }
  }

  /**
   * 管理员登出
   */
  async adminLogout(): Promise<{ success: boolean; error?: string }> {
    try {
      const adminUser = await this.getCurrentAdminUser();
      if (!adminUser) {
        return { success: false, error: '管理员用户不存在' };
      }

      // 停用所有活跃会话
      const { error } = await supabase
        .from('admin_sessions')
        .update({ is_active: false })
        .eq('admin_user_id', adminUser.id)
        .eq('is_active', true);

      if (error) {
        console.error('停用管理员会话失败:', error);
        return { success: false, error: '登出失败' };
      }

      // 记录登出日志
      await this.logOperation('admin_logout', 'system', null, {
        logout_time: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      console.error('管理员登出异常:', error);
      return { success: false, error: '登出异常' };
    }
  }

  /**
   * 验证管理员会话
   */
  async validateAdminSession(sessionToken: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('admin_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('验证管理员会话异常:', error);
      return false;
    }
  }

  /**
   * 记录管理员操作日志
   */
  async logOperation(
    operationType: string,
    targetType: string,
    targetId: string | null,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const adminUser = await this.getCurrentAdminUser();
      if (!adminUser) return;

      await supabase
        .from('admin_operation_logs')
        .insert({
          admin_user_id: adminUser.id,
          operation_type: operationType,
          target_type: targetType,
          target_id: targetId,
          operation_details: details,
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent
        });
    } catch (error) {
      console.error('记录管理员操作日志失败:', error);
    }
  }

  /**
   * 获取管理员操作日志
   */
  async getOperationLogs(
    page: number = 1,
    limit: number = 50,
    filters?: {
      adminUserId?: string;
      operationType?: string;
      targetType?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ data: AdminOperationLog[]; total: number; error?: string }> {
    try {
      let query = supabase
        .from('admin_operation_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // 应用过滤器
      if (filters?.adminUserId) {
        query = query.eq('admin_user_id', filters.adminUserId);
      }
      if (filters?.operationType) {
        query = query.eq('operation_type', filters.operationType);
      }
      if (filters?.targetType) {
        query = query.eq('target_type', filters.targetType);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      // 分页
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('获取管理员操作日志失败:', error);
        return { data: [], total: 0, error: '获取日志失败' };
      }

      return { data: data || [], total: count || 0 };
    } catch (error) {
      console.error('获取管理员操作日志异常:', error);
      return { data: [], total: 0, error: '获取日志异常' };
    }
  }

  /**
   * 生成会话token
   */
  private generateSessionToken(): string {
    return `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取客户端IP地址
   */
  private async getClientIP(): Promise<string | null> {
    try {
      // 在实际应用中，这应该从服务器端获取真实IP
      // 这里只是一个占位符实现
      return null;
    } catch (error) {
      return null;
    }
  }
}

export const adminAuthService = new AdminAuthService();
export default adminAuthService;