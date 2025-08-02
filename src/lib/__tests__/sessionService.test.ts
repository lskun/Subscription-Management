import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SessionService } from '@/services/sessionService'
import { supabase } from '@/lib/supabase'
import type { Session, User, AuthError } from '@supabase/supabase-js'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      signOut: vi.fn(),
    }
  }
}))

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

// Mock window events
const eventListeners: { [key: string]: EventListener[] } = {}
const mockAddEventListener = vi.fn((event: string, callback: EventListener) => {
  if (!eventListeners[event]) {
    eventListeners[event] = []
  }
  eventListeners[event].push(callback)
})

const mockRemoveEventListener = vi.fn((event: string, callback: EventListener) => {
  if (eventListeners[event]) {
    const index = eventListeners[event].indexOf(callback)
    if (index > -1) {
      eventListeners[event].splice(index, 1)
    }
  }
})

const mockDispatchEvent = vi.fn((event: Event) => {
  if (eventListeners[event.type]) {
    eventListeners[event.type].forEach(listener => listener(event))
  }
})

Object.defineProperty(window, 'addEventListener', { value: mockAddEventListener })
Object.defineProperty(window, 'removeEventListener', { value: mockRemoveEventListener })
Object.defineProperty(window, 'dispatchEvent', { value: mockDispatchEvent })

// Mock document events
const mockDocumentAddEventListener = vi.fn()
const mockDocumentRemoveEventListener = vi.fn()
Object.defineProperty(document, 'addEventListener', { value: mockDocumentAddEventListener })
Object.defineProperty(document, 'removeEventListener', { value: mockDocumentRemoveEventListener })

// Mock sessionStorage
const sessionStorageMock = {
  clear: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

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

// Helper function to create mock auth error
const createMockAuthError = (message: string, code: string = 'auth_error'): AuthError => {
  const error = new Error(message) as AuthError
  error.name = 'AuthError'
  error.code = code
  error.status = 500
  return error
}

describe('SessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()
    localStorageMock.getItem.mockReturnValue(null)
    
    // 清理事件监听器
    Object.keys(eventListeners).forEach(key => {
      eventListeners[key] = []
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    SessionService.stopSessionManagement()
    SessionService.cleanupSessionData()
  })

  describe('getCurrentSessionState', () => {
    it('should return valid session state when session exists', async () => {
      const mockSession = createMockSession()

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      const state = await SessionService.getCurrentSessionState()

      expect(state.session).toEqual(mockSession)
      expect(state.user).toEqual(mockSession.user)
      expect(state.isAuthenticated).toBe(true)
      expect(state.isLoading).toBe(false)
      expect(state.expiresAt).toBe(mockSession.expires_at * 1000)
    })

    it('should return empty session state when no session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      })

      const state = await SessionService.getCurrentSessionState()

      expect(state.session).toBeNull()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.expiresAt).toBeNull()
    })

    it('should handle session fetch error', async () => {
      const mockError = createMockAuthError('Session fetch failed')

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: mockError
      })

      const state = await SessionService.getCurrentSessionState()

      expect(state.session).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('validateSession', () => {
    it('should return true for valid session', async () => {
      const mockSession = createMockSession()

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      const isValid = await SessionService.validateSession()

      expect(isValid).toBe(true)
    })

    it('should return false for expired session', async () => {
      const mockSession = createMockSession({
        expires_at: Math.floor(Date.now() / 1000) - 3600 // 1小时前过期
      })

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      const isValid = await SessionService.validateSession()

      expect(isValid).toBe(false)
    })

    it('should return false when no session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      })

      const isValid = await SessionService.validateSession()

      expect(isValid).toBe(false)
    })
  })

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const mockNewSession = createMockSession({
        access_token: 'new_token'
      })

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: mockNewSession },
        error: null
      })

      const success = await SessionService.forceRefresh()

      expect(success).toBe(true)
      expect(supabase.auth.refreshSession).toHaveBeenCalled()
    })

    it('should handle refresh failure', async () => {
      const mockError = createMockAuthError('Refresh failed')

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: null },
        error: mockError
      })

      const success = await SessionService.forceRefresh()

      expect(success).toBe(false)
    })
  })

  describe('signOut', () => {
    it('should successfully sign out', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null })

      await SessionService.signOut('user_initiated')

      expect(supabase.auth.signOut).toHaveBeenCalled()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('lastActivity')
    })

    it('should handle sign out error gracefully', async () => {
      const mockError = createMockAuthError('Sign out failed')

      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: mockError
      })

      // 应该不抛出异常
      await expect(SessionService.signOut('user_initiated')).resolves.toBeUndefined()
    })
  })

  describe('session management', () => {
    it('should start and stop session management', () => {
      SessionService.startSessionManagement()
      
      // 验证活动监听器被添加
      expect(mockDocumentAddEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function), { passive: true })
      expect(mockDocumentAddEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function), { passive: true })
      
      SessionService.stopSessionManagement()
      
      // 验证监听器被移除
      expect(mockDocumentRemoveEventListener).toHaveBeenCalled()
    })

    it('should update last activity on user interaction', () => {
      SessionService.startSessionManagement()
      
      // 获取添加的事件监听器
      const addEventListenerCalls = mockDocumentAddEventListener.mock.calls
      const mousedownCall = addEventListenerCalls.find(call => call[0] === 'mousedown')
      
      expect(mousedownCall).toBeDefined()
      
      // 直接调用事件处理器
      if (mousedownCall) {
        const eventHandler = mousedownCall[1]
        eventHandler(new Event('mousedown'))
      }
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('lastActivity', expect.any(String))
    })
  })

  describe('getSessionInfo', () => {
    it('should return session info from localStorage', () => {
      const lastActivity = Date.now()
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'lastActivity') return lastActivity.toString()
        if (key === 'supabase.auth.token') {
          return JSON.stringify({
            expires_at: Math.floor(Date.now() / 1000) + 3600
          })
        }
        return null
      })

      const info = SessionService.getSessionInfo()

      expect(info.lastActivity).toBe(lastActivity)
      expect(info.expiresAt).toBeDefined()
      expect(info.timeUntilExpiry).toBeGreaterThan(0)
    })

    it('should handle missing session data', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const info = SessionService.getSessionInfo()

      expect(info.lastActivity).toBe(0)
      expect(info.expiresAt).toBeNull()
      expect(info.timeUntilExpiry).toBeNull()
    })
  })

  describe('checkSessionHealth', () => {
    it('should return healthy status for valid session', async () => {
      const mockSession = createMockSession()

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      localStorageMock.getItem.mockReturnValue(Date.now().toString())

      // 启动会话管理以确保activityTimer存在
      SessionService.startSessionManagement()

      const health = await SessionService.checkSessionHealth()

      expect(health.isHealthy).toBe(true)
      expect(health.issues).toHaveLength(0)
    })

    it('should detect expired session', async () => {
      const mockSession = createMockSession({
        expires_at: Math.floor(Date.now() / 1000) - 3600 // 1小时前过期
      })

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      const health = await SessionService.checkSessionHealth()

      expect(health.isHealthy).toBe(false)
      expect(health.issues).toContain('会话已过期')
      expect(health.recommendations).toContain('请重新登录')
    })

    it('should detect inactivity timeout', async () => {
      const mockSession = createMockSession()

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession, user: mockSession.user },
        error: null
      })

      // 模拟长时间无活动
      const oldActivity = Date.now() - (31 * 60 * 1000) // 31分钟前
      localStorageMock.getItem.mockReturnValue(oldActivity.toString())

      const health = await SessionService.checkSessionHealth()

      expect(health.isHealthy).toBe(false)
      expect(health.issues).toContain('长时间无活动')
    })
  })

  describe('recoverSessionManagement', () => {
    it('should recover session management for valid session', async () => {
      const mockSession = createMockSession()

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession, user: mockSession.user },
        error: null
      })

      const success = await SessionService.recoverSessionManagement()

      expect(success).toBe(true)
    })

    it('should fail to recover for invalid session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null, user: null },
        error: null
      })

      const success = await SessionService.recoverSessionManagement()

      expect(success).toBe(false)
    })
  })

  describe('cleanupSessionData', () => {
    it('should clean up all session data', () => {
      SessionService.cleanupSessionData()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('lastActivity')
      expect(sessionStorageMock.clear).toHaveBeenCalled()
    })
  })
})