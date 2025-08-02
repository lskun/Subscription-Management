import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null }))
        }))
      }))
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      }))
    }
  }
}))

import { supabaseUserSettingsService } from '../supabaseUserSettingsService'
import { supabase } from '@/lib/supabase'

const mockSupabase = supabase as any

describe('SupabaseUserSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserSettings', () => {
    it('应该获取用户的所有设置', async () => {
      const mockSettings = [
        { setting_key: 'currency', setting_value: 'USD' },
        { setting_key: 'theme', setting_value: 'dark' },
        { setting_key: 'show_original_currency', setting_value: false }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: mockSettings, error: null }))
        }))
      })

      const result = await supabaseUserSettingsService.getUserSettings()
      
      expect(result).toEqual({
        currency: 'USD',
        theme: 'dark',
        show_original_currency: false,
        timezone: 'Asia/Shanghai',
        language: 'zh-CN'
      })
      expect(mockSupabase.from).toHaveBeenCalledWith('user_settings')
    })

    it('应该在没有设置时返回默认值', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })

      const result = await supabaseUserSettingsService.getUserSettings()
      
      expect(result).toEqual({
        currency: 'CNY',
        theme: 'system',
        show_original_currency: true,
        timezone: 'Asia/Shanghai',
        language: 'zh-CN'
      })
    })

    it('应该处理用户未登录的情况', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      await expect(supabaseUserSettingsService.getUserSettings()).rejects.toThrow('用户未登录')
    })
  })

  describe('setSetting', () => {
    it('应该设置单个设置值', async () => {
      // 确保用户已登录
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      })
      
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn(() => Promise.resolve({ error: null }))
      })

      await expect(supabaseUserSettingsService.setSetting('theme', 'dark')).resolves.not.toThrow()
      
      expect(mockSupabase.from).toHaveBeenCalledWith('user_settings')
    })

    it('应该处理设置失败的情况', async () => {
      // 确保用户已登录
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      })
      
      const mockError = { message: '数据库错误' }
      
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn(() => Promise.resolve({ error: mockError }))
      })

      await expect(supabaseUserSettingsService.setSetting('theme', 'dark'))
        .rejects.toThrow('设置用户设置失败: 数据库错误')
    })
  })

  describe('setSettings', () => {
    it('应该批量设置多个设置值', async () => {
      // 确保用户已登录
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      })
      
      const settings = {
        currency: 'USD' as const,
        theme: 'dark' as const,
        show_original_currency: false
      }

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn(() => Promise.resolve({ error: null }))
      })

      await expect(supabaseUserSettingsService.setSettings(settings)).resolves.not.toThrow()
      
      expect(mockSupabase.from).toHaveBeenCalledWith('user_settings')
    })
  })

  describe('getSetting', () => {
    it('应该获取单个设置值', async () => {
      // 确保用户已登录
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      })
      
      const mockSetting = { setting_value: 'dark' }

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: mockSetting, error: null }))
            }))
          }))
        }))
      })

      const result = await supabaseUserSettingsService.getSetting('theme')
      
      expect(result).toBe('dark')
    })

    it('应该在设置不存在时返回null', async () => {
      // 确保用户已登录
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      })
      
      const mockError = { code: 'PGRST116', message: 'No rows found' }

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: mockError }))
            }))
          }))
        }))
      })

      const result = await supabaseUserSettingsService.getSetting('nonexistent')
      
      expect(result).toBeNull()
    })
  })

  describe('resetAllSettings', () => {
    it('应该重置所有用户设置', async () => {
      // 确保用户已登录
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      })
      
      mockSupabase.from.mockReturnValue({
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null }))
        }))
      })

      await expect(supabaseUserSettingsService.resetAllSettings()).resolves.not.toThrow()
      
      expect(mockSupabase.from).toHaveBeenCalledWith('user_settings')
    })
  })

  describe('convenience methods', () => {
    it('应该正确处理主题设置', async () => {
      // 确保用户已登录
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      })
      
      // Mock getSetting for getTheme
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { setting_value: 'dark' }, error: null }))
            }))
          }))
        }))
      })

      const theme = await supabaseUserSettingsService.getTheme()
      expect(theme).toBe('dark')

      // Mock upsert for setTheme
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn(() => Promise.resolve({ error: null }))
      })

      await expect(supabaseUserSettingsService.setTheme('light')).resolves.not.toThrow()
    })

    it('应该正确处理货币设置', async () => {
      // 确保用户已登录
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      })
      
      // Mock getSetting for getCurrency
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { setting_value: 'USD' }, error: null }))
            }))
          }))
        }))
      })

      const currency = await supabaseUserSettingsService.getCurrency()
      expect(currency).toBe('USD')

      // Mock upsert for setCurrency
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn(() => Promise.resolve({ error: null }))
      })

      await expect(supabaseUserSettingsService.setCurrency('EUR')).resolves.not.toThrow()
    })
  })
})