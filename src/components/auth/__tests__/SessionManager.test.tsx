import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SessionManager } from '../SessionManager'
import { useAuth } from '@/contexts/AuthContext'
import type { User, Session } from '@supabase/supabase-js'

// Mock useAuth hook
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
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

const mockAuthContext = {
  user: createMockUser(),
  session: createMockSession(),
  loading: false,
  isSessionValid: true,
  lastActivity: Date.now(),
  expiresAt: Date.now() + 3600000,
  timeUntilExpiry: 3600000,
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPassword: vi.fn(),
  updatePassword: vi.fn(),
  updateProfile: vi.fn(),
  refreshSession: vi.fn(),
  validateSession: vi.fn(),
  forceRefresh: vi.fn(),
  getSessionInfo: vi.fn(),
  getDetailedSessionInfo: vi.fn(),
  checkSessionHealth: vi.fn(),
  recoverSession: vi.fn()
}

describe('SessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue(mockAuthContext)
  })

  it('should render session manager for authenticated user', () => {
    render(<SessionManager />)
    
    expect(screen.getByText('会话管理')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('已登录')).toBeInTheDocument()
  })

  it('should show not logged in message for unauthenticated user', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...mockAuthContext,
      user: null,
      session: null,
      isSessionValid: false
    })

    render(<SessionManager />)
    
    expect(screen.getByText('用户未登录')).toBeInTheDocument()
  })

  it('should handle refresh session button click', async () => {
    const mockRefreshSession = vi.fn().mockResolvedValue(true)
    vi.mocked(useAuth).mockReturnValue({
      ...mockAuthContext,
      refreshSession: mockRefreshSession
    })

    render(<SessionManager />)
    
    const refreshButton = screen.getByText('刷新会话')
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(mockRefreshSession).toHaveBeenCalled()
    })
  })

  it('should handle validate session button click', async () => {
    const mockValidateSession = vi.fn().mockResolvedValue(true)
    vi.mocked(useAuth).mockReturnValue({
      ...mockAuthContext,
      validateSession: mockValidateSession
    })

    render(<SessionManager />)
    
    const validateButton = screen.getByText('验证会话')
    fireEvent.click(validateButton)

    await waitFor(() => {
      expect(mockValidateSession).toHaveBeenCalled()
    })
  })

  it('should show session expiry progress when session is expiring soon', () => {
    const fiveMinutesInMs = 5 * 60 * 1000
    vi.mocked(useAuth).mockReturnValue({
      ...mockAuthContext,
      timeUntilExpiry: fiveMinutesInMs - 1000, // 4分59秒
      expiresAt: Date.now() + fiveMinutesInMs - 1000
    })

    render(<SessionManager />)
    
    expect(screen.getByText('会话剩余时间')).toBeInTheDocument()
    expect(screen.getByText('⚠️ 会话即将过期，建议刷新')).toBeInTheDocument()
  })

  it('should show detailed session info when enabled', async () => {
    const mockGetDetailedSessionInfo = vi.fn().mockResolvedValue({
      isActive: true,
      expiresAt: Date.now() + 3600000,
      timeUntilExpiry: 3600000,
      lastActivity: Date.now() - 60000,
      isValid: true,
      needsRefresh: false
    })

    vi.mocked(useAuth).mockReturnValue({
      ...mockAuthContext,
      getDetailedSessionInfo: mockGetDetailedSessionInfo
    })

    render(<SessionManager showDetailedInfo={true} />)

    await waitFor(() => {
      expect(screen.getByText('详细信息')).toBeInTheDocument()
      expect(screen.getByText('最后活动:')).toBeInTheDocument()
      expect(screen.getByText('过期时间:')).toBeInTheDocument()
    })
  })

  it('should show health check results when enabled', async () => {
    const mockCheckSessionHealth = vi.fn().mockResolvedValue({
      isHealthy: false,
      issues: ['会话即将过期'],
      recommendations: ['建议刷新会话']
    })

    vi.mocked(useAuth).mockReturnValue({
      ...mockAuthContext,
      checkSessionHealth: mockCheckSessionHealth
    })

    render(<SessionManager showHealthCheck={true} />)

    await waitFor(() => {
      expect(screen.getByText('检测到会话问题:')).toBeInTheDocument()
      expect(screen.getByText('会话即将过期')).toBeInTheDocument()
      expect(screen.getByText('建议刷新会话')).toBeInTheDocument()
    })
  })

  it('should show recover button when session is unhealthy', async () => {
    const mockCheckSessionHealth = vi.fn().mockResolvedValue({
      isHealthy: false,
      issues: ['会话管理未启动'],
      recommendations: ['重新启动会话管理']
    })

    vi.mocked(useAuth).mockReturnValue({
      ...mockAuthContext,
      checkSessionHealth: mockCheckSessionHealth
    })

    render(<SessionManager showHealthCheck={true} />)

    await waitFor(() => {
      expect(screen.getByText('恢复管理')).toBeInTheDocument()
    })
  })
})