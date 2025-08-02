import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from '@/services/authService'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    }
  }
}))

// Helper function to create mock user
const createMockUser = (overrides?: Partial<User>): User => ({
  id: '123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  ...overrides
})

// Helper function to create mock session
const createMockSession = (overrides?: Partial<Session>): Session => ({
  user: createMockUser(),
  access_token: 'token',
  refresh_token: 'refresh_token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  ...overrides
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  describe('signInWithGoogle', () => {
    it('should call supabase auth with correct parameters', async () => {
      const mockResponse = { data: { user: { id: '123' } }, error: null }
      vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue(mockResponse)

      const result = await AuthService.signInWithGoogle()

      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle errors gracefully', async () => {
      const mockError = new Error('OAuth failed')
      vi.mocked(supabase.auth.signInWithOAuth).mockRejectedValue(mockError)

      const result = await AuthService.signInWithGoogle()

      expect(result.data).toBeNull()
      expect(result.error).toEqual(mockError)
    })
  })

  describe('signInWithEmail', () => {
    it('should call supabase auth with email and password', async () => {
      const mockResponse = { data: { user: createMockUser(), session: createMockSession() }, error: null }
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(mockResponse)

      const result = await AuthService.signInWithEmail('test@example.com', 'password')

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      })
      expect(result).toEqual(mockResponse)
    })

    it('should clear login failures on successful login', async () => {
      const mockResponse = { data: { user: createMockUser(), session: createMockSession() }, error: null }
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(mockResponse)

      await AuthService.signInWithEmail('test@example.com', 'password')

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('login_attempts_test@example.com')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('lockout_test@example.com')
    })

    it('should record login failure on invalid credentials', async () => {
      const mockError = new Error('Invalid login credentials') as any
      mockError.code = 'invalid_credentials'
      
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: mockError
      })

      await AuthService.signInWithEmail('test@example.com', 'wrongpassword')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'login_attempts_test@example.com',
        expect.stringContaining('"attempts":1')
      )
    })

    it('should lock account after 3 failed attempts', async () => {
      const mockError = new Error('Invalid login credentials') as any
      mockError.code = 'invalid_credentials'
      
      // Mock existing 2 attempts
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        attempts: 2,
        firstAttemptTime: Date.now() - 60000,
        lastAttemptTime: Date.now() - 30000
      }))
      
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: mockError
      })

      await AuthService.signInWithEmail('test@example.com', 'wrongpassword')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'lockout_test@example.com',
        expect.stringContaining('"attempts":3')
      )
    })

    it('should prevent login when account is locked', async () => {
      // Mock locked account
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'lockout_test@example.com') {
          return JSON.stringify({
            lockedUntil: Date.now() + 10 * 60 * 1000, // 10 minutes from now
            attempts: 3
          })
        }
        return null
      })

      const result = await AuthService.signInWithEmail('test@example.com', 'password')

      expect(result.error?.code).toBe('account_locked')
      expect(result.error?.message).toContain('账户已被锁定')
      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
    })
  })

  describe('getRemainingLockoutTime', () => {
    it('should return remaining lockout time', () => {
      const lockedUntil = Date.now() + 5 * 60 * 1000 // 5 minutes from now
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        lockedUntil,
        attempts: 3
      }))

      const remainingTime = AuthService.getRemainingLockoutTime('test@example.com')

      expect(remainingTime).toBeGreaterThan(4 * 60 * 1000) // Should be close to 5 minutes
      expect(remainingTime).toBeLessThanOrEqual(5 * 60 * 1000)
    })

    it('should return 0 when account is not locked', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const remainingTime = AuthService.getRemainingLockoutTime('test@example.com')

      expect(remainingTime).toBe(0)
    })

    it('should return 0 when lockout has expired', () => {
      const lockedUntil = Date.now() - 60000 // 1 minute ago
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        lockedUntil,
        attempts: 3
      }))

      const remainingTime = AuthService.getRemainingLockoutTime('test@example.com')

      expect(remainingTime).toBe(0)
    })
  })

  describe('signUp', () => {
    it('should call supabase auth with registration data', async () => {
      const mockResponse = { data: { user: { id: '123' } }, error: null }
      vi.mocked(supabase.auth.signUp).mockResolvedValue(mockResponse)

      const result = await AuthService.signUp('test@example.com', 'password', { name: 'Test User' })

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
        options: {
          data: { name: 'Test User' },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = { id: '123', email: 'test@example.com' }
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null })

      const result = await AuthService.getCurrentUser()

      expect(result).toEqual(mockUser)
    })

    it('should return null on error', async () => {
      vi.mocked(supabase.auth.getUser).mockRejectedValue(new Error('Failed'))

      const result = await AuthService.getCurrentUser()

      expect(result).toBeNull()
    })
  })

  describe('getCurrentSession', () => {
    it('should return current session', async () => {
      const mockSession = { user: { id: '123' }, access_token: 'token' }
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: mockSession }, error: null })

      const result = await AuthService.getCurrentSession()

      expect(result).toEqual(mockSession)
    })
  })

  describe('signOut', () => {
    it('should call supabase signOut', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null })

      const result = await AuthService.signOut()

      expect(supabase.auth.signOut).toHaveBeenCalled()
      expect(result.error).toBeNull()
    })
  })

  describe('resetPassword', () => {
    it('should call resetPasswordForEmail with correct parameters', async () => {
      const mockResponse = { data: {}, error: null }
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue(mockResponse)

      const result = await AuthService.resetPassword('test@example.com')

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('updatePassword', () => {
    it('should call updateUser with new password', async () => {
      const mockResponse = { data: { user: { id: '123' } }, error: null }
      vi.mocked(supabase.auth.updateUser).mockResolvedValue(mockResponse)

      const result = await AuthService.updatePassword('newpassword')

      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword'
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('updateProfile', () => {
    it('should call updateUser with profile updates', async () => {
      const mockResponse = { data: { user: { id: '123' } }, error: null }
      vi.mocked(supabase.auth.updateUser).mockResolvedValue(mockResponse)

      const updates = { email: 'new@example.com', data: { name: 'New Name' } }
      const result = await AuthService.updateProfile(updates)

      expect(supabase.auth.updateUser).toHaveBeenCalledWith(updates)
      expect(result).toEqual(mockResponse)
    })
  })
})