import { supabase } from '../lib/supabase';
import { AdminMiddleware, ADMIN_PERMISSIONS } from '../utils/adminMiddleware';
import { adminAuthService } from './adminAuthService';

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  phone?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
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
      // 验证权限
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.VIEW_USERS);
      if (!permissionCheck.success) {
        return { users: [], total: 0, error: permissionCheck.error };
      }

      let query = supabase
        .from('auth.users')
        .select('*', { count: 'exact' });

      // 应用搜索过滤器
      if (filters?.search) {
        query = query.or(`email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
      }

      // 应用状态过滤器
      if (filters?.status) {
        switch (filters.status) {
          case 'active':
            query = query.not('last_sign_in_at', 'is', null);
            break;
          case 'inactive':
            query = query.is('last_sign_in_at', null);
            break;
          case 'suspended':
            // 这里需要根据实际的用户状态字段来过滤
            break;
        }
      }

      // 应用日期范围过滤器
      if (filters?.dateRange) {
        query = query
          .gte('created_at', filters.dateRange.start)
          .lte('created_at', filters.dateRange.end);
      }

      // 应用排序
      const sortBy = filters?.sortBy || 'created_at';
      const sortOrder = filters?.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // 应用分页
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('获取用户列表失败:', error);
        return { users: [], total: 0, error: '获取用户列表失败' };
      }

      // 记录操作日志
      await adminAuthService.logOperation(
        'user_list_view',
        'user',
        null,
        {
          filters,
          page,
          limit,
          resultCount: data?.length || 0
        }
      );

      return {
        users: data || [],
        total: count || 0
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
      // 验证权限
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

      // 记录操作日志
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
   * 更新用户信息
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

      // 更新用户信息
      const { error } = await supabase.auth.admin.updateUserById(userId, updates);

      if (error) {
        console.error('更新用户信息失败:', error);
        return { success: false, error: '更新用户信息失败' };
      }

      // 记录操作日志
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
   * 暂停/激活用户
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

      // 根据操作类型更新用户状态
      const updates = action === 'suspend' 
        ? { banned_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() } // 暂停一年
        : { banned_until: null }; // 取消暂停

      const { error } = await supabase.auth.admin.updateUserById(userId, updates);

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
        .from('auth.users')
        .select('id, email, created_at, last_sign_in_at')
        .or(`email.ilike.%${query}%,phone.ilike.%${query}%`)
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
      // 验证权限
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.VIEW_ANALYTICS);
      if (!permissionCheck.success) {
        return {
          totalUsers: 0,
          activeUsers: 0,
          newUsersThisMonth: 0,
          suspendedUsers: 0,
          error: permissionCheck.error
        };
      }

      // 获取总用户数
      const { count: totalUsers, error: totalError } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        console.error('获取总用户数失败:', totalError);
      }

      // 获取活跃用户数（最近30天登录）
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: activeUsers, error: activeError } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true })
        .gte('last_sign_in_at', thirtyDaysAgo.toISOString());

      if (activeError) {
        console.error('获取活跃用户数失败:', activeError);
      }

      // 获取本月新用户数
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const { count: newUsersThisMonth, error: newError } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thisMonth.toISOString());

      if (newError) {
        console.error('获取新用户数失败:', newError);
      }

      // 获取暂停用户数
      const { count: suspendedUsers, error: suspendedError } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true })
        .not('banned_until', 'is', null);

      if (suspendedError) {
        console.error('获取暂停用户数失败:', suspendedError);
      }

      return {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        newUsersThisMonth: newUsersThisMonth || 0,
        suspendedUsers: suspendedUsers || 0
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