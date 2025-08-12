import { supabase } from '../lib/supabase';
import { AdminMiddleware, ADMIN_PERMISSIONS } from '../utils/adminMiddleware';
import { adminAuthService } from './adminAuthService';

export interface UserProfile {
  id: string;
  display_name: string;
  email: string;
  created_at: string;
  updated_at: string;
  phone?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  last_login_time?: string;
  is_blocked?: boolean;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_name: string;
  status: string;
  created_at: string;
  expires_at?: string;
}

export interface UserStats {
  totalSubscriptions: number;
  totalSpent: number;
  lastActivity?: string;
  registrationDate: string;
}

export interface UserListFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'suspended';
  planType?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  sortBy?: 'created_at' | 'last_sign_in_at' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export interface UserOperationHistory {
  id: string;
  user_id: string;
  operation_type: string;
  operation_details: Record<string, any>;
  performed_by: string;
  performed_at: string;
  ip_address?: string;
}

class AdminUserManagementService {
  /**
   * 获取用户列表
   */
  async getUserList(
    page: number = 1,
    limit: number = 20,
    filters?: UserListFilters
  ): Promise<{
    users: UserProfile[];
    total: number;
    error?: string;
  }> {
    try {
      // Verify permissions
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.VIEW_USERS);
      if (!permissionCheck.success) {
        return { users: [], total: 0, error: permissionCheck.error };
      }

      // 改为调用 RPC（super_admin 校验、绕过 RLS），服务端完成筛选/搜索/分页排序
      const { data, error } = await supabase.rpc('list_users', {
        p_page: page,
        p_limit: limit,
        p_search: filters?.search || null,
        p_status: filters?.status || null
      });
      if (error) {
        console.error('获取用户列表失败:', error);
        return { users: [], total: 0, error: '获取用户列表失败' };
      }

      // Log operation
      await adminAuthService.logOperation(
        'user_list_view',
        'user',
        null,
        {
          filters,
          page,
          limit,
          resultCount: (data?.users || []).length || 0
        }
      );

      return {
        users: (data?.users || []) as unknown as UserProfile[],
        total: (data?.total || 0) as number
      };
    } catch (error) {
      console.error('获取用户列表异常:', error);
      return { users: [], total: 0, error: '获取用户列表异常' };
    }
  }

  /**
   * 获取用户详细信息
   */
  async getUserDetails(userId: string): Promise<{
    user?: UserProfile;
    subscriptions?: UserSubscription[];
    stats?: UserStats;
    error?: string;
  }> {
    try {
      // Verify permissions
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.VIEW_USERS);
      if (!permissionCheck.success) {
        return { error: permissionCheck.error };
      }

      // 获取用户基本信息
      const { data: user, error: userError } = await supabase
        .from('auth.users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('获取用户信息失败:', userError);
        return { error: '用户不存在' };
      }

      // 获取用户订阅信息
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (subscriptionsError) {
        console.error('获取用户订阅失败:', subscriptionsError);
      }

      // 计算用户统计信息
      const stats: UserStats = {
        totalSubscriptions: subscriptions?.length || 0,
        totalSpent: subscriptions?.reduce((sum, sub) => sum + (sub.amount || 0), 0) || 0,
        lastActivity: user.last_sign_in_at,
        registrationDate: user.created_at
      };

      // Log operation
      await adminAuthService.logOperation(
        'user_detail_view',
        'user',
        userId,
        { viewedSections: ['profile', 'subscriptions', 'stats'] }
      );

      return {
        user,
        subscriptions: subscriptions || [],
        stats
      };
    } catch (error) {
      console.error('获取用户详情异常:', error);
      return { error: '获取用户详情异常' };
    }
  }

  /**
   * Update user information
   */
  async updateUser(
    userId: string,
    updates: {
      email?: string;
      phone?: string;
      user_metadata?: Record<string, any>;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 验证权限
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.EDIT_USERS);
      if (!permissionCheck.success) {
        return { success: false, error: permissionCheck.error };
      }

      // Update user information
      const { error } = await supabase.auth.admin.updateUserById(userId, updates);

      if (error) {
        console.error('更新用户信息失败:', error);
        return { success: false, error: '更新用户信息失败' };
      }

      // Log operation
      await adminAuthService.logOperation(
        'user_update',
        'user',
        userId,
        { updates, updatedFields: Object.keys(updates) }
      );

      return { success: true };
    } catch (error) {
      console.error('更新用户信息异常:', error);
      return { success: false, error: '更新用户信息异常' };
    }
  }

  /**
   * Suspend/activate user
   */
  async toggleUserStatus(
    userId: string,
    action: 'suspend' | 'activate'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 验证权限
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.MANAGE_USERS);
      if (!permissionCheck.success) {
        return { success: false, error: permissionCheck.error };
      }

      // Update user status based on operation type
      const isBlocked = action === 'suspend';
      
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_blocked: isBlocked })
        .eq('id', userId);

      if (error) {
        console.error(`${action}用户失败:`, error);
        return { success: false, error: `${action}用户失败` };
      }

      // 记录操作日志
      await adminAuthService.logOperation(
        action === 'suspend' ? 'user_suspend' : 'user_activate',
        'user',
        userId,
        { action, reason: `管理员${action}用户` }
      );

      return { success: true };
    } catch (error) {
      console.error(`${action}用户异常:`, error);
      return { success: false, error: `${action}用户异常` };
    }
  }

  /**
   * 删除用户
   */
  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 验证权限
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.DELETE_USERS);
      if (!permissionCheck.success) {
        return { success: false, error: permissionCheck.error };
      }

      // 删除用户
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) {
        console.error('删除用户失败:', error);
        return { success: false, error: '删除用户失败' };
      }

      // 记录操作日志
      await adminAuthService.logOperation(
        'user_delete',
        'user',
        userId,
        { reason: '管理员删除用户', deletedAt: new Date().toISOString() }
      );

      return { success: true };
    } catch (error) {
      console.error('删除用户异常:', error);
      return { success: false, error: '删除用户异常' };
    }
  }

  /**
   * 获取用户操作历史
   */
  async getUserOperationHistory(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    operations: UserOperationHistory[];
    total: number;
    error?: string;
  }> {
    try {
      // 验证权限
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.VIEW_USERS);
      if (!permissionCheck.success) {
        return { operations: [], total: 0, error: permissionCheck.error };
      }

      // 获取用户相关的操作日志
      const { data, error, count } = await supabase
        .from('admin_operation_logs')
        .select('*', { count: 'exact' })
        .eq('target_id', userId)
        .eq('target_type', 'user')
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) {
        console.error('获取用户操作历史失败:', error);
        return { operations: [], total: 0, error: '获取操作历史失败' };
      }

      // 转换数据格式
      const operations: UserOperationHistory[] = (data || []).map(log => ({
        id: log.id,
        user_id: userId,
        operation_type: log.operation_type,
        operation_details: log.operation_details,
        performed_by: log.admin_user_id,
        performed_at: log.created_at,
        ip_address: log.ip_address
      }));

      return {
        operations,
        total: count || 0
      };
    } catch (error) {
      console.error('获取用户操作历史异常:', error);
      return { operations: [], total: 0, error: '获取操作历史异常' };
    }
  }

  /**
   * 搜索用户
   */
  async searchUsers(
    query: string,
    limit: number = 10
  ): Promise<{
    users: UserProfile[];
    error?: string;
  }> {
    try {
      // 验证权限
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.VIEW_USERS);
      if (!permissionCheck.success) {
        return { users: [], error: permissionCheck.error };
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, display_name, created_at, updated_at, last_login_time')
        .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(limit);

      if (error) {
        console.error('搜索用户失败:', error);
        return { users: [], error: '搜索用户失败' };
      }

      // 记录操作日志
      await adminAuthService.logOperation(
        'user_search',
        'user',
        null,
        { query, resultCount: data?.length || 0 }
      );

      return { users: data || [] };
    } catch (error) {
      console.error('搜索用户异常:', error);
      return { users: [], error: '搜索用户异常' };
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    newUsersThisMonth: number;
    suspendedUsers: number;
    error?: string;
  }> {
    try {
      // 调用带 super_admin 校验的 RPC，绕过 RLS 获取真实统计
      const { data, error } = await supabase.rpc('get_user_stats');
      if (error) {
        return {
          totalUsers: 0,
          activeUsers: 0,
          newUsersThisMonth: 0,
          suspendedUsers: 0,
          error: error.message
        };
      }
      return {
        totalUsers: data?.totalUsers ?? 0,
        activeUsers: data?.activeUsers30d ?? 0,
        newUsersThisMonth: data?.newUsersThisMonth ?? 0,
        suspendedUsers: data?.suspendedUsers ?? 0
      };
    } catch (error) {
      console.error('获取用户统计异常:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        newUsersThisMonth: 0,
        suspendedUsers: 0,
        error: '获取统计信息异常'
      };
    }
  }
}

export const adminUserManagementService = new AdminUserManagementService();
export default adminUserManagementService;