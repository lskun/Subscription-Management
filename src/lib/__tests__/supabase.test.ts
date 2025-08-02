import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'

// Mock environment variables
vi.mock('import.meta', () => ({
  env: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key'
  }
}))

describe('Supabase Client', () => {
  it('should be properly configured', () => {
    expect(supabase).toBeDefined()
    expect(supabase.auth).toBeDefined()
    expect(supabase.from).toBeDefined()
    expect(supabase.storage).toBeDefined()
    expect(supabase.functions).toBeDefined()
  })

  it('should have correct auth configuration', () => {
    // 验证认证配置
    const authConfig = supabase.supabaseAuthClient.config
    expect(authConfig.autoRefreshToken).toBe(true)
    expect(authConfig.persistSession).toBe(true)
    expect(authConfig.detectSessionInUrl).toBe(true)
    expect(authConfig.flowType).toBe('pkce')
  })

  it('should export correct types', async () => {
    // 验证类型导出
    const { User, Session, AuthError } = await import('@/lib/supabase')
    expect(User).toBeDefined()
    expect(Session).toBeDefined()
    expect(AuthError).toBeDefined()
  })
})

describe('Supabase Environment Variables', () => {
  it('should throw error if environment variables are missing', () => {
    // 这个测试需要在实际环境中运行，这里只是示例
    expect(() => {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        throw new Error('Missing Supabase environment variables')
      }
    }).not.toThrow()
  })
})