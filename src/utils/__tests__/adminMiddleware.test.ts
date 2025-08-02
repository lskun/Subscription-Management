import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminMiddleware, PermissionUtils, AdminPermissionValidator } from '../adminMiddleware';
import { adminAuthService } from '../../services/adminAuthService';

// Mock adminAuthService
vi.mock('../../services/adminAuthService', () => ({
  adminAuthService: {
    isAdmin: vi.fn(),
    hasPermission: vi.fn(),
    getCurrentAdminUser: vi.fn(),
    logOperation: vi.fn(),
  },
}));

describe('AdminMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAdmin', () => {
    it('should return success when user is admin', async () => {
      vi.mocked(adminAuthService.isAdmin).mockResolvedValue(true);
      vi.mocked(adminAuthService.getCurrentAdminUser).mockResolvedValue({
        id: 'admin-1',
        user_id: 'user-1',
        role_id: 'role-1',
        is_active: true,
        created_by: 'user-0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });

      const result = await AdminMiddleware.requireAdmin();

      expect(result.success).toBe(true);
      expect(result.adminUser).toBeDefined();
    });

    it('should return error when user is not admin', async () => {
      vi.mocked(adminAuthService.isAdmin).mockResolvedValue(false);

      const result = await AdminMiddleware.requireAdmin();

      expect(result.success).toBe(false);
      expect(result.error).toBe('需要管理员权限');
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(adminAuthService.isAdmin).mockRejectedValue(new Error('Network error'));

      const result = await AdminMiddleware.requireAdmin();

      expect(result.success).toBe(false);
      expect(result.error).toBe('权限验证失败');
    });
  });

  describe('requirePermission', () => {
    it('should return success when user has permission', async () => {
      vi.mocked(adminAuthService.isAdmin).mockResolvedValue(true);
      vi.mocked(adminAuthService.getCurrentAdminUser).mockResolvedValue({
        id: 'admin-1',
        user_id: 'user-1',
        role_id: 'role-1',
        is_active: true,
        created_by: 'user-0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(adminAuthService.hasPermission).mockResolvedValue(true);

      const result = await AdminMiddleware.requirePermission('manage_users');

      expect(result.success).toBe(true);
      expect(adminAuthService.hasPermission).toHaveBeenCalledWith('manage_users');
    });

    it('should return error when user lacks permission', async () => {
      vi.mocked(adminAuthService.isAdmin).mockResolvedValue(true);
      vi.mocked(adminAuthService.getCurrentAdminUser).mockResolvedValue({
        id: 'admin-1',
        user_id: 'user-1',
        role_id: 'role-1',
        is_active: true,
        created_by: 'user-0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(adminAuthService.hasPermission).mockResolvedValue(false);

      const result = await AdminMiddleware.requirePermission('manage_users');

      expect(result.success).toBe(false);
      expect(result.error).toBe('需要权限: manage_users');
    });
  });

  describe('requireAllPermissions', () => {
    it('should return success when user has all permissions', async () => {
      vi.mocked(adminAuthService.isAdmin).mockResolvedValue(true);
      vi.mocked(adminAuthService.getCurrentAdminUser).mockResolvedValue({
        id: 'admin-1',
        user_id: 'user-1',
        role_id: 'role-1',
        is_active: true,
        created_by: 'user-0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(adminAuthService.hasPermission).mockResolvedValue(true);

      const result = await AdminMiddleware.requireAllPermissions(['manage_users', 'view_users']);

      expect(result.success).toBe(true);
      expect(adminAuthService.hasPermission).toHaveBeenCalledTimes(2);
    });

    it('should return error when user lacks any permission', async () => {
      vi.mocked(adminAuthService.isAdmin).mockResolvedValue(true);
      vi.mocked(adminAuthService.getCurrentAdminUser).mockResolvedValue({
        id: 'admin-1',
        user_id: 'user-1',
        role_id: 'role-1',
        is_active: true,
        created_by: 'user-0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(adminAuthService.hasPermission)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await AdminMiddleware.requireAllPermissions(['manage_users', 'delete_users']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('需要权限: delete_users');
    });
  });

  describe('requireAnyPermission', () => {
    it('should return success when user has any permission', async () => {
      vi.mocked(adminAuthService.isAdmin).mockResolvedValue(true);
      vi.mocked(adminAuthService.getCurrentAdminUser).mockResolvedValue({
        id: 'admin-1',
        user_id: 'user-1',
        role_id: 'role-1',
        is_active: true,
        created_by: 'user-0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(adminAuthService.hasPermission)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await AdminMiddleware.requireAnyPermission(['manage_users', 'view_users']);

      expect(result.success).toBe(true);
    });

    it('should return error when user has no permissions', async () => {
      vi.mocked(adminAuthService.isAdmin).mockResolvedValue(true);
      vi.mocked(adminAuthService.getCurrentAdminUser).mockResolvedValue({
        id: 'admin-1',
        user_id: 'user-1',
        role_id: 'role-1',
        is_active: true,
        created_by: 'user-0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      vi.mocked(adminAuthService.hasPermission).mockResolvedValue(false);

      const result = await AdminMiddleware.requireAnyPermission(['manage_users', 'view_users']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('需要以下权限之一: manage_users, view_users');
    });
  });

  describe('withAdminPermission', () => {
    it('should execute function when user is admin', async () => {
      vi.mocked(adminAuthService.isAdmin).mockResolvedValue(true);
      vi.mocked(adminAuthService.getCurrentAdminUser).mockResolvedValue({
        id: 'admin-1',
        user_id: 'user-1',
        role_id: 'role-1',
        is_active: true,
        created_by: 'user-0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });

      const mockFn = vi.fn().mockResolvedValue('success');
      const wrappedFn = AdminMiddleware.withAdminPermission(mockFn);

      const result = await wrappedFn('arg1', 'arg2');

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should throw error when user is not admin', async () => {
      vi.mocked(adminAuthService.isAdmin).mockResolvedValue(false);

      const mockFn = vi.fn();
      const wrappedFn = AdminMiddleware.withAdminPermission(mockFn);

      await expect(wrappedFn()).rejects.toThrow('需要管理员权限');
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  describe('withLogging', () => {
    it('should log successful operations', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const wrappedFn = AdminMiddleware.withLogging(
        'test_operation',
        'test_target',
        mockFn,
        () => 'target-id',
        () => ({ detail: 'test' })
      );

      const result = await wrappedFn('arg1');

      expect(result).toBe('success');
      expect(adminAuthService.logOperation).toHaveBeenCalledWith(
        'test_operation',
        'test_target',
        'target-id',
        expect.objectContaining({
          detail: 'test',
          success: true,
          result: 'success'
        })
      );
    });

    it('should log failed operations', async () => {
      const error = new Error('Test error');
      const mockFn = vi.fn().mockRejectedValue(error);
      const wrappedFn = AdminMiddleware.withLogging(
        'test_operation',
        'test_target',
        mockFn
      );

      await expect(wrappedFn()).rejects.toThrow('Test error');
      expect(adminAuthService.logOperation).toHaveBeenCalledWith(
        'test_operation',
        'test_target',
        null,
        expect.objectContaining({
          success: false,
          error: 'Test error'
        })
      );
    });
  });
});

describe('PermissionUtils', () => {
  describe('hasAnyPermission', () => {
    it('should return true for super admin', () => {
      const userPermissions = { super_admin: true };
      const result = PermissionUtils.hasAnyPermission(userPermissions, ['manage_users']);

      expect(result).toBe(true);
    });

    it('should return true when user has any required permission', () => {
      const userPermissions = { view_users: true, manage_users: false };
      const result = PermissionUtils.hasAnyPermission(userPermissions, ['manage_users', 'view_users']);

      expect(result).toBe(true);
    });

    it('should return false when user has no required permissions', () => {
      const userPermissions = { view_analytics: true };
      const result = PermissionUtils.hasAnyPermission(userPermissions, ['manage_users', 'view_users']);

      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true for super admin', () => {
      const userPermissions = { super_admin: true };
      const result = PermissionUtils.hasAllPermissions(userPermissions, ['manage_users', 'view_users']);

      expect(result).toBe(true);
    });

    it('should return true when user has all required permissions', () => {
      const userPermissions = { manage_users: true, view_users: true };
      const result = PermissionUtils.hasAllPermissions(userPermissions, ['manage_users', 'view_users']);

      expect(result).toBe(true);
    });

    it('should return false when user lacks any required permission', () => {
      const userPermissions = { manage_users: true, view_users: false };
      const result = PermissionUtils.hasAllPermissions(userPermissions, ['manage_users', 'view_users']);

      expect(result).toBe(false);
    });
  });
});

describe('AdminPermissionValidator', () => {
  describe('validateBatch', () => {
    it('should validate multiple permissions', async () => {
      vi.mocked(adminAuthService.hasPermission)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await AdminPermissionValidator.validateBatch([
        'manage_users',
        'delete_users',
        'view_users'
      ]);

      expect(result).toEqual({
        manage_users: true,
        delete_users: false,
        view_users: true
      });
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(adminAuthService.hasPermission)
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await AdminPermissionValidator.validateBatch([
        'manage_users',
        'delete_users'
      ]);

      expect(result).toEqual({
        manage_users: true,
        delete_users: false
      });
    });
  });

  describe('canPerformOperation', () => {
    it('should allow operation when user has all required permissions', async () => {
      vi.mocked(adminAuthService.getCurrentAdminUser).mockResolvedValue({
        id: 'admin-1',
        user_id: 'user-1',
        role_id: 'role-1',
        is_active: true,
        created_by: 'user-0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        role: {
          id: 'role-1',
          name: 'admin',
          description: 'Administrator',
          permissions: { manage_users: true, view_users: true },
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        }
      });

      const result = await AdminPermissionValidator.canPerformOperation(
        'manage_user',
        ['manage_users', 'view_users']
      );

      expect(result.canPerform).toBe(true);
      expect(result.missingPermissions).toEqual([]);
    });

    it('should deny operation when user lacks required permissions', async () => {
      vi.mocked(adminAuthService.getCurrentAdminUser).mockResolvedValue({
        id: 'admin-1',
        user_id: 'user-1',
        role_id: 'role-1',
        is_active: true,
        created_by: 'user-0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        role: {
          id: 'role-1',
          name: 'support',
          description: 'Support',
          permissions: { view_users: true },
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        }
      });

      const result = await AdminPermissionValidator.canPerformOperation(
        'manage_user',
        ['manage_users', 'delete_users']
      );

      expect(result.canPerform).toBe(false);
      expect(result.missingPermissions).toEqual(['manage_users', 'delete_users']);
    });

    it('should allow all operations for super admin', async () => {
      vi.mocked(adminAuthService.getCurrentAdminUser).mockResolvedValue({
        id: 'admin-1',
        user_id: 'user-1',
        role_id: 'role-1',
        is_active: true,
        created_by: 'user-0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        role: {
          id: 'role-1',
          name: 'super_admin',
          description: 'Super Administrator',
          permissions: { super_admin: true },
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        }
      });

      const result = await AdminPermissionValidator.canPerformOperation(
        'any_operation',
        ['manage_users', 'delete_users', 'manage_system']
      );

      expect(result.canPerform).toBe(true);
      expect(result.missingPermissions).toEqual([]);
    });
  });
});