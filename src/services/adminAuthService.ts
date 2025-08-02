import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

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
  /**
   * 检查当前用户是否为管理员
   */
  async isAdmin(): Promise<boolean> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      const { data, error } = await supabase.rpc('is_admin_user', {
        user_uuid: user.user.id
      });

      if (error) {
        console.error('检查管理员状态失败:', error);
        return false;
      }

      return data || false;
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
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      const { data, error } = await supabase.rpc('has_admin_permission', {
        user_uuid: user.user.id,
        permission_name: permission
      });

      if (error) {
        console.error('检查管理员权限失败:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('检查管理员权限异常:', error);
      return false;
    }
  }

  /**
   * 获取当前管理员用户信息
   */
  async getCurrentAdminUser(): Promise<AdminUser | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;

      const { data, error } = await supabase
        .from('admin_users')
        .select(`
          *,
          role:admin_roles(*)
        `)
        .eq('user_id', user.user.id)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('获取管理员用户信息失败:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('获取管理员用户信息异常:', error);
      return null;
    }
  }

  /**
   * 管理员登录（创建管理员会话）
   */
  async adminLogin(): Promise<{ success: boolean; session?: AdminSession; error?: string }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
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