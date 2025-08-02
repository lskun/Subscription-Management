import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { adminAuthService } from '../adminAuthService';
import { supabase } from '../../lib/supabase';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn()
        }))
      }))
    }))
  }
}));

describe('AdminAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAdmin', () => {
    it('应该返回true当用户是管理员时', async () => {
      // Mock用户已登录
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      // Mock RPC调用返回true
      (supabase.rpc as Mock).mockResolvedValue({
        data: true,
        error: null
      });

      const result = await adminAuthService.isAdmin();

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('is_admin_user', {
        user_uuid: 'user-123'
      });
    });

    it('应该返回false当用户不是管理员时', async () => {
      // Mock用户已登录
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      // Mock RPC调用返回false
      (supabase.rpc as Mock).mockResolvedValue({
        data: false,
        error: null
      });

      const result = await adminAuthService.isAdmin();

      expect(result).toBe(false);
    });

    it('应该返回false当用户未登录时', async () => {
      // Mock用户未登录
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: null }
      });

      const result = await adminAuthService.isAdmin();

      expect(result).toBe(false);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('应该返回false当RPC调用出错时', async () => {
      // Mock用户已登录
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      // Mock RPC调用出错
      (supabase.rpc as Mock).mockResolvedValue({
        data: null,
        error: { message: 'RPC error' }
      });

      const result = await adminAuthService.isAdmin();

      expect(result).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('应该返回true当用户有指定权限时', async () => {
      // Mock用户已登录
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      // Mock RPC调用返回true
      (supabase.rpc as Mock).mockResolvedValue({
        data: true,
        error: null
      });

      const result = await adminAuthService.hasPermission('manage_users');

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('has_admin_permission', {
        user_uuid: 'user-123',
        permission_name: 'manage_users'
      });
    });

    it('应该返回false当用户没有指定权限时', async () => {
      // Mock用户已登录
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      // Mock RPC调用返回false
      (supabase.rpc as Mock).mockResolvedValue({
        data: false,
        error: null
      });

      const result = await adminAuthService.hasPermission('manage_users');

      expect(result).toBe(false);
    });
  });

  describe('getCurrentAdminUser', () => {
    it('应该返回管理员用户信息', async () => {
      const mockAdminUser = {
        id: 'admin-123',
        user_id: 'user-123',
        role_id: 'role-123',
        is_active: true,
        role: {
          id: 'role-123',
          name: 'admin',
          permissions: { manage_users: true }
        }
      };

      // Mock用户已登录
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      // Mock查询返回管理员用户信息
      const mockQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: mockAdminUser,
                error: null
              })
            }))
          }))
        }))
      };
      (supabase.from as Mock).mockReturnValue(mockQuery);

      const result = await adminAuthService.getCurrentAdminUser();

      expect(result).toEqual(mockAdminUser);
      expect(supabase.from).toHaveBeenCalledWith('admin_users');
    });

    it('应该返回null当用户不是管理员时', async () => {
      // Mock用户已登录
      (supabase.auth.getUser as Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      // Mock查询返回错误
      const mockQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'No admin user found' }
              })
            }))
          }))
        }))
      };
      (supabase.from as Mock).mockReturnValue(mockQuery);

      const result = await adminAuthService.getCurrentAdminUser();

      expect(result).toBeNull();
    });
  });

  describe('logOperation', () => {
    it('应该成功记录操作日志', async () => {
      const mockAdminUser = {
        id: 'admin-123',
        user_id: 'user-123'
      };

      // Mock getCurrentAdminUser
      vi.spyOn(adminAuthService, 'getCurrentAdminUser').mockResolvedValue(mockAdminUser as any);

      // Mock插入操作
      const mockInsert = {
        insert: vi.fn().mockResolvedValue({
          data: { id: 'log-123' },
          error: null
        })
      };
      (supabase.from as Mock).mockReturnValue(mockInsert);

      await adminAuthService.logOperation(
        'user_view',
        'user',
        'target-123',
        { action: 'view user profile' }
      );

      expect(supabase.from).toHaveBeenCalledWith('admin_operation_logs');
      expect(mockInsert.insert).toHaveBeenCalledWith({
        admin_user_id: 'admin-123',
        operation_type: 'user_view',
        target_type: 'user',
        target_id: 'target-123',
        operation_details: { action: 'view user profile' },
        ip_address: null,
        user_agent: expect.any(String)
      });
    });

    it('应该在非管理员用户时静默失败', async () => {
      // Mock getCurrentAdminUser返回null
      vi.spyOn(adminAuthService, 'getCurrentAdminUser').mockResolvedValue(null);

      // 不应该抛出错误
      await expect(
        adminAuthService.logOperation('user_view', 'user', 'target-123', {})
      ).resolves.toBeUndefined();

      expect(supabase.from).not.toHaveBeenCalled();
    });
  });
});