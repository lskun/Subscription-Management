import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { supabaseExchangeRateService, SupabaseExchangeRateService } from '@/services/supabaseExchangeRateService'
import { logger } from '@/utils/logger'
import { BASE_CURRENCY, DEFAULT_EXCHANGE_RATES, type CurrencyType } from '@/config/currency'
import { supabaseUserSettingsService, type ThemeType } from '@/services/supabaseUserSettingsService'

export type { ThemeType }

// 缓存持续时间配置
// 建议的优化配置：延长缓存时间以提高复用性
// USER_CACHE_DURATION: 用户信息缓存，建议 5分钟（300秒）
// GLOBAL_CACHE_DURATION: 全局数据缓存（如userProfiles），建议 10分钟（600秒）
// 原配置：USER_CACHE_DURATION = 5000, GLOBAL_CACHE_DURATION = 30000
const USER_CACHE_DURATION = 300000 // 用户缓存有效期：5分钟 (UserCacheService) - 优化后
const GLOBAL_CACHE_DURATION = 600000 // 全局缓存有效期：10分钟 (GlobalCacheService) - 优化后

/**
 * 设置状态接口定义
 * 包含用户设置、缓存管理、错误处理等功能
 */
interface SettingsState {
  // 基础设置 - 与后端同步
  apiKey: string | null // API密钥
  setApiKey: (apiKey: string) => void
  currency: CurrencyType // 用户选择的货币类型
  setCurrency: (currency: CurrencyType) => Promise<void>
  theme: ThemeType // 主题设置（明亮/暗黑/系统）
  setTheme: (theme: ThemeType) => Promise<void>

  // 货币显示设置
  showOriginalCurrency: boolean // 是否显示原始货币
  setShowOriginalCurrency: (show: boolean) => void

  // 通知设置
  notifications: {
    email: boolean
    renewal_reminders: boolean
    payment_notifications: boolean
  } // 通知设置
  setNotifications: (notifications: SettingsState['notifications']) => Promise<void>

  // 完整用户设置缓存
  userSettingsCache: Record<string, any> | null // 完整的用户设置数据缓存
  userSettingsCacheTimestamp: number // 用户设置缓存时间戳
  getCachedSetting: (settingKey: string) => any // 从缓存中获取特定设置值
  isSettingsCacheValid: () => boolean // 检查设置缓存是否有效

  // 汇率相关设置
  exchangeRates: Record<string, number> // 汇率数据缓存
  updateExchangeRate: (currency: string, rate: number) => void
  lastExchangeRateUpdate: string | null // 最后更新汇率的时间
  updateLastExchangeRateUpdate: () => void
  fetchExchangeRates: () => Promise<void> // 从缓存或API获取汇率
  updateExchangeRatesFromApi: () => Promise<void> // 强制从API更新汇率

  // 数据管理
  resetSettings: () => void // 重置所有设置到默认值
  fetchSettings: () => Promise<void> // 获取用户设置
  isLoading: boolean // 加载状态
  error: string | null // 错误信息

  // 请求去重机制
  _fetchPromise: Promise<void> | null // 当前进行中的获取请求
  _lastFetchTime: number | null // 最后一次获取的时间

  // === 用户缓存功能 (原 UserCacheService) ===
  currentUser: User | null // 当前用户信息
  userCacheTimestamp: number // 用户缓存时间戳
  userCachePendingRequest: Promise<User | null> | null // 待处理的用户请求
  getCurrentUser: () => Promise<User | null> // 获取当前用户（带缓存）
  updateUserCache: (user: User | null) => void // 更新用户缓存
  clearUserCache: () => void // 清除用户缓存
  forceRefreshUser: () => Promise<User | null> // 强制刷新用户信息
  getUserCacheStatus: () => { hasCache: boolean; cacheAge: number; isValid: boolean } // 获取缓存状态

  // === 通用缓存功能 (原 GlobalCacheService) ===
  globalCache: Record<string, { data: any; timestamp: number }> // 全局数据缓存
  globalPromiseCache: Record<string, Promise<any>> // Promise缓存（防止重复请求）
  generateCacheKey: (type: string, id: string) => string // 生成缓存键
  getFromGlobalCache: <T>(key: string) => { data: T | null; promise: Promise<T> | null } // 从缓存获取数据
  setGlobalCache: <T>(key: string, data: T) => void // 设置缓存数据
  setGlobalCachePromise: <T>(key: string, promise: Promise<T>) => void // 设置Promise缓存
  clearGlobalCache: (key: string) => void // 清除指定缓存
  clearGlobalCacheByType: (type: string) => void // 按类型清除缓存
  clearGlobalCacheById: (id: string) => void // 按ID清除缓存
  clearGlobalCachePromise: (key: string) => void // 清除Promise缓存
  cacheSupabaseRequest: <T>(url: string, fetchFunction: () => Promise<T>) => Promise<T> // Supabase请求缓存
  clearUrlCache: (url: string) => void // 清除URL缓存
  
  // 错误处理辅助方法
  isUserNotLoggedInError: (error: any) => boolean // 判断是否为用户未登录错误
  formatErrorMessage: (error: any) => string // 格式化错误消息为用户友好的文本
}

/**
 * 初始设置配置
 * 定义所有设置的默认值
 */
export const initialSettings = {
  // 与后端同步的基础设置
  apiKey: null, // API密钥，初始为空
  currency: BASE_CURRENCY, // 默认货币类型
  theme: 'system' as ThemeType, // 默认跟随系统主题
  showOriginalCurrency: true, // 默认显示原始货币

  // 通知设置初始值
  notifications: {
    email: true,
    renewal_reminders: true,
    payment_notifications: true
  }, // 默认通知设置

  // 用户设置缓存初始值
  userSettingsCache: null, // 初始无缓存
  userSettingsCacheTimestamp: 0, // 缓存时间戳为0

  // 汇率相关初始值
  exchangeRates: DEFAULT_EXCHANGE_RATES, // 默认汇率数据
  lastExchangeRateUpdate: null, // 汇率更新时间初始为空
  
  // 状态管理初始值
  isLoading: false, // 初始非加载状态
  error: null, // 初始无错误

  // 请求去重机制初始值
  _fetchPromise: null, // 无进行中的请求
  _lastFetchTime: null, // 无历史请求时间

  // 用户缓存初始值
  currentUser: null, // 初始无用户信息
  userCacheTimestamp: 0, // 缓存时间戳为0
  userCachePendingRequest: null, // 无待处理请求

  // 全局缓存初始值
  globalCache: {}, // 空的全局缓存对象
  globalPromiseCache: {}, // 空的Promise缓存对象
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...initialSettings,

      /**
       * 获取用户设置
       * 包含请求去重、缓存机制和错误处理
       */
      /**
       * 获取用户设置
       * 实现完整的缓存机制，用户登录后第一次请求时缓存所有设置项
       */
      fetchSettings: async () => {
        const state = get()
        const now = Date.now()
        const CACHE_DURATION = 300000 // 5分钟缓存有效期

        // 检查用户设置缓存是否有效
        if (state.userSettingsCache && 
            state.userSettingsCacheTimestamp && 
            (now - state.userSettingsCacheTimestamp) < CACHE_DURATION) {
          console.log('🎯 使用用户设置缓存数据', {
            cacheAge: Math.round((now - state.userSettingsCacheTimestamp) / 1000),
            maxAge: Math.round(CACHE_DURATION / 1000)
          })
          return // 使用缓存数据
        }

        // 检查是否有进行中的请求
        if (state._fetchPromise) {
          console.log('⏳ 等待现有的设置数据获取请求')
          return state._fetchPromise
        }

        const fetchPromise = (async () => {
          set({ isLoading: true, error: null })
          try {
            console.log('🔄 从服务器获取用户设置数据')
            
            // 获取当前用户
            const user = await state.getCurrentUser()
            if (!user) {
              console.warn('👤 用户未登录，使用默认设置')
              set({
                ...initialSettings,
                isLoading: false,
                _lastFetchTime: now,
                _fetchPromise: null
              })
              return
            }

            // 直接调用 Supabase API 获取完整的用户设置数据
            const { data, error } = await supabase
              .from('user_settings')
              .select('setting_key, setting_value')
              .eq('user_id', user.id)

            if (error) {
              throw new Error(`获取用户设置失败: ${error.message}`)
            }

            // 构建完整的设置缓存对象
            const settingsCache: Record<string, any> = {}
            const parsedSettings = {
              currency: initialSettings.currency,
              theme: initialSettings.theme,
              showOriginalCurrency: initialSettings.showOriginalCurrency,
              notifications: { ...initialSettings.notifications }
            }

            // 解析设置数据
            data?.forEach(setting => {
              let value = setting.setting_value
              
              // 如果setting_value是对象且包含value属性，提取实际值
              if (typeof value === 'object' && value !== null && 'value' in value) {
                value = (value as any).value
              }
              
              settingsCache[setting.setting_key] = setting.setting_value
              
              // 更新对应的状态
              switch (setting.setting_key) {
                case 'currency':
                  parsedSettings.currency = value || initialSettings.currency
                  break
                case 'theme':
                  parsedSettings.theme = value || initialSettings.theme
                  break
                case 'show_original_currency':
                  parsedSettings.showOriginalCurrency = value !== undefined ? Boolean(value) : initialSettings.showOriginalCurrency
                  break
                case 'notifications':
                  if (typeof value === 'object' && value !== null) {
                    parsedSettings.notifications = {
                      email: value.email !== undefined ? Boolean(value.email) : initialSettings.notifications.email,
                      renewal_reminders: value.renewal_reminders !== undefined ? Boolean(value.renewal_reminders) : initialSettings.notifications.renewal_reminders,
                      payment_notifications: value.payment_notifications !== undefined ? Boolean(value.payment_notifications) : initialSettings.notifications.payment_notifications
                    }
                  }
                  break
              }
            })

            console.log('✅ 用户设置数据获取成功，已缓存', {
              settingsCount: Object.keys(settingsCache).length,
              parsedSettings
            })

            // 更新状态和缓存
            set({
              ...parsedSettings,
              userSettingsCache: settingsCache,
              userSettingsCacheTimestamp: now,
              isLoading: false,
              _lastFetchTime: now,
              _fetchPromise: null
            })

          } catch (error: any) {
            logger.error('❌ 获取用户设置失败:', error)

            // 检查是否为用户未登录错误
            const isUserNotLoggedIn = get().isUserNotLoggedInError(error)
            
            if (isUserNotLoggedIn) {
              console.warn('👤 用户未登录，使用默认设置')
              set({
                ...initialSettings,
                isLoading: false,
                error: null,
                _lastFetchTime: now,
                _fetchPromise: null
              })
            } else {
              // 其他类型的错误，设置错误状态
              set({
                error: get().formatErrorMessage(error),
                isLoading: false,
                _fetchPromise: null
              })
            }
          }
        })()

        set({ _fetchPromise: fetchPromise })
        return fetchPromise
      },

      /**
       * 设置API密钥
       * 仅更新本地状态，不同步到后端
       */
      setApiKey: (apiKey) => set({ apiKey }),

      /**
       * 设置用户货币类型
       * 同步更新到Supabase后端，并清除相关缓存
       */
      setCurrency: async (currency) => {
        set({ currency })

        // 同步到Supabase后端
        try {
          await supabaseUserSettingsService.setCurrency(currency)
          
          // 清除用户配置相关缓存，确保下次获取最新数据
          const { clearGlobalCacheByType, clearUserCache } = get()
          clearGlobalCacheByType('userProfile')
          clearGlobalCacheByType('userSettings')
          clearUserCache() // 清除用户缓存，触发重新获取
        } catch (error: any) {
          logger.error('Error saving currency setting:', error)
          // 可选择在此处回滚本地更改
        }
      },

      /**
       * 设置用户主题
       * 同步更新到Supabase后端，并清除相关缓存
       */
      setTheme: async (theme) => {
        set({ theme })
        // 不在此处应用主题 - 让next-themes处理
        // localStorage也由next-themes处理

        // 同步到Supabase后端
        try {
          await supabaseUserSettingsService.setTheme(theme)
          
          // 清除用户配置相关缓存，确保下次获取最新数据
          const { clearGlobalCacheByType, clearUserCache } = get()
          clearGlobalCacheByType('userProfile')
          clearGlobalCacheByType('userSettings')
          clearUserCache() // 清除用户缓存，触发重新获取
        } catch (error: any) {
          logger.error('Error saving theme setting:', error)
        }
      },


      /**
       * 设置是否显示原始货币
       * 同步更新到Supabase后端，并清除相关缓存
       */
      setShowOriginalCurrency: async (showOriginalCurrency) => {
        set({ showOriginalCurrency })

        // 同步到Supabase后端
        try {
          await supabaseUserSettingsService.setShowOriginalCurrency(showOriginalCurrency)
          
          // 清除用户配置相关缓存，确保下次获取最新数据
          const { clearGlobalCacheByType, clearUserCache } = get()
          clearGlobalCacheByType('userProfile')
          clearGlobalCacheByType('userSettings')
          clearUserCache() // 清除用户缓存，触发重新获取
        } catch (error: any) {
          logger.error('Error saving showOriginalCurrency setting:', error)
          // 可选择在此处回滚本地更改
        }
      },

      /**
        * 设置通知偏好
        * @param notifications 通知设置对象
        */
       setNotifications: async (notifications: SettingsState['notifications']) => {
         const previousNotifications = get().notifications
         set({ notifications })
         try {
           await supabaseUserSettingsService.setSetting('notifications', notifications)
           logger.info('Notification settings updated successfully')
           
           // 更新缓存中的通知设置
           const state = get()
           if (state.userSettingsCache) {
             set({
               userSettingsCache: {
                 ...state.userSettingsCache,
                 notifications
               }
             })
           }
         } catch (error) {
           logger.error('Error updating notification settings:', error)
           // 回滚状态
           set({ notifications: previousNotifications })
           throw error
         }
       },


      /**
       * 更新单个货币的汇率
       * 仅更新本地缓存，不同步到后端
       */
      updateExchangeRate: (currency, rate) => set((state) => ({
        exchangeRates: { ...state.exchangeRates, [currency]: rate }
      })),

      /**
       * 更新汇率最后更新时间
       * 记录汇率数据的最新获取时间
       */
      updateLastExchangeRateUpdate: () => set({
        lastExchangeRateUpdate: new Date().toISOString()
      }),

      /**
       * 获取汇率数据
       * 从Supabase获取最新汇率并更新本地缓存
       */
      fetchExchangeRates: async () => {
        try {
          // 从Supabase汇率服务获取最新汇率数据
          const rates = await supabaseExchangeRateService.getLatestRates();
          // 将汇率数组转换为键值对映射
          const rateMap = SupabaseExchangeRateService.ratesToMap(rates);

          // 更新本地汇率缓存和最后更新时间
          set({
            exchangeRates: rateMap,
            lastExchangeRateUpdate: new Date().toISOString()
          });
        } catch (error: any) {
          logger.error('Error fetching exchange rates:', error);
          // 保持现有汇率，不更新错误状态，因为这可能在后台运行
        }
      },

      /**
       * 从API强制更新汇率数据
       * 使用Edge Function调用外部API更新汇率
       */
      updateExchangeRatesFromApi: async () => {
        try {
          // 动态导入Supabase客户端
          const { supabase } = await import('@/lib/supabase');

          // 调用Edge Function更新汇率
          const { data, error } = await supabase.functions.invoke('update-exchange-rates', {
            body: {
              updateType: 'manual', // 手动更新类型
              currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'] // 需要更新的货币列表
            }
          });

          // 检查Edge Function调用错误
          if (error) {
            throw new Error(error.message);
          }

          // 检查更新操作是否成功
          if (!data?.success) {
            throw new Error(data?.error || 'Update failed');
          }

          // 更新成功后重新获取汇率数据
          await get().fetchExchangeRates();

          logger.info(`Successfully updated ${data.rates_updated} exchange rates`);
        } catch (error: any) {
          logger.error('Error updating exchange rates:', error);
          set({ error: error.message });
          throw error; // 抛出错误供调用方处理
        }
      },

      /**
       * 重置所有用户设置到默认值
       * 同步重置后端数据并恢复本地状态，清除所有相关缓存
       */
      resetSettings: async () => {
        try {
          // 重置Supabase后端的所有用户设置
          await supabaseUserSettingsService.resetAllSettings()

          // 重置本地状态到初始设置值
          set({ ...initialSettings })
          // 不在此处应用主题 - 让next-themes处理主题切换

          // 清除所有用户配置相关缓存，确保下次获取最新数据
          const { clearGlobalCacheByType, clearUserCache } = get()
          clearGlobalCacheByType('userProfile')
          clearGlobalCacheByType('userSettings')
          clearUserCache() // 清除用户缓存，触发重新获取

          return { error: null }
        } catch (error: any) {
          logger.error('Error resetting settings:', error)
          // 设置错误状态供UI显示
          set({ error: error.message })
          return { error }
        }
      },

      // === 用户缓存方法实现 (原 UserCacheService) ===
      /**
       * 获取当前用户信息
       * 包含缓存机制，避免频繁调用Supabase API
       */
      getCurrentUser: async () => {
        const state = get()
        const now = Date.now()

        // 如果缓存有效，直接返回缓存的用户
        if (state.currentUser && (now - state.userCacheTimestamp) < USER_CACHE_DURATION) {
          return state.currentUser
        }

        // 如果有正在进行的请求，等待它完成
        if (state.userCachePendingRequest) {
          return state.userCachePendingRequest
        }

        // 创建新的用户获取请求
        const fetchUserPromise = (async () => {
          try {
            // 动态导入Supabase客户端
            const { supabase } = await import('@/lib/supabase')
            // 从Supabase获取当前用户信息
            const { data: { user }, error } = await supabase.auth.getUser()

            if (error) {
              console.error('获取用户信息失败:', error)
              // 获取失败时清除用户缓存
              set({
                currentUser: null,
                userCacheTimestamp: 0,
                userCachePendingRequest: null
              })
              return null
            }

            // 更新用户缓存和时间戳
            set({
              currentUser: user,
              userCacheTimestamp: now,
              userCachePendingRequest: null
            })

            return user
          } catch (error) {
            console.error('获取用户信息异常:', error)
            // 异常时清除用户缓存
            set({
              currentUser: null,
              userCacheTimestamp: 0,
              userCachePendingRequest: null
            })
            return null
          }
        })()

        // 设置进行中的请求标记
        set({ userCachePendingRequest: fetchUserPromise })
        return fetchUserPromise
      },

      /**
       * 更新用户缓存
       * 手动设置用户信息和缓存时间戳
       */
      updateUserCache: (user: User | null) => {
        set({
          currentUser: user,
          userCacheTimestamp: Date.now(), // 更新缓存时间戳
          userCachePendingRequest: null // 清除待处理请求
        })
      },

      /**
       * 清除用户缓存
       * 重置所有用户相关的缓存状态
       */
      clearUserCache: () => {
        set({
          currentUser: null, // 清除用户信息
          userCacheTimestamp: 0, // 重置时间戳
          userCachePendingRequest: null, // 清除待处理请求
          userSettingsCache: null, // 清除用户设置缓存
          userSettingsCacheTimestamp: 0 // 重置设置缓存时间戳
        })
      },

      /**
       * 从缓存中获取特定设置值
       * @param settingKey 设置键名
       * @returns 设置值或 null
       */
      getCachedSetting: (settingKey: string) => {
        const state = get()
        if (!state.userSettingsCache) {
          return null
        }
        return state.userSettingsCache[settingKey] || null
      },

      /**
       * 检查设置缓存是否有效
       * @returns 缓存是否有效
       */
      isSettingsCacheValid: () => {
        const state = get()
        const now = Date.now()
        const CACHE_DURATION = 300000 // 5分钟
        
        return !!(state.userSettingsCache && 
                 state.userSettingsCacheTimestamp && 
                 (now - state.userSettingsCacheTimestamp) < CACHE_DURATION)
      },

      /**
       * 强制刷新用户信息
       * 清除缓存后重新获取用户数据
       */
      forceRefreshUser: async () => {
        get().clearUserCache() // 先清除现有缓存
        return get().getCurrentUser() // 重新获取用户信息
      },

      /**
       * 获取用户缓存状态
       * 返回缓存是否存在、缓存年龄和是否有效
       */
      getUserCacheStatus: () => {
        const state = get()
        const now = Date.now()
        const cacheAge = now - state.userCacheTimestamp // 计算缓存年龄

        return {
          hasCache: state.currentUser !== null, // 检查是否有缓存
          cacheAge,
          isValid: state.currentUser !== null && cacheAge < USER_CACHE_DURATION // 检查缓存是否有效
        }
      },

      // === 通用缓存方法实现 (原 GlobalCacheService) ===
      /**
       * 生成缓存键
       * 根据类型和ID生成统一格式的缓存键
       */
      generateCacheKey: (type: string, id: string) => {
        return `${type}:${id}` // 格式：类型:ID
      },

      /**
       * 从全局缓存获取数据
       * 检查缓存有效性，返回数据或进行中的Promise
       */
      getFromGlobalCache: <T>(key: string) => {
        const state = get()
        const now = Date.now()
        const cached = state.globalCache[key] // 获取缓存数据

        // 检查缓存是否存在且未过期
        if (cached && now - cached.timestamp < GLOBAL_CACHE_DURATION) {
          return { data: cached.data as T, promise: null } // 返回有效缓存数据
        }

        // 检查是否有正在进行的请求
        const promise = state.globalPromiseCache[key] as Promise<T> | undefined
        return { data: null, promise: promise || null } // 缓存无效或不存在，返回进行中的Promise（如果有）
      },

      /**
       * 设置全局缓存数据
       * 存储数据和当前时间戳
       */
      setGlobalCache: <T>(key: string, data: T) => {
        set((state) => ({
          globalCache: {
            ...state.globalCache,
            [key]: {
              data, // 缓存的数据
              timestamp: Date.now(), // 缓存时间戳
            }
          }
        }))
      },

      /**
       * 设置全局Promise缓存
       * 存储进行中的Promise，避免重复请求
       */
      setGlobalCachePromise: <T>(key: string, promise: Promise<T>) => {
        set((state) => ({
          globalPromiseCache: {
            ...state.globalPromiseCache,
            [key]: promise // 存储进行中的Promise
          }
        }))
      },

      /**
       * 清除指定键的全局缓存
       * 删除对应的数据缓存
       */
      clearGlobalCache: (key: string) => {
        set((state) => {
          const newCache = { ...state.globalCache }
          delete newCache[key] // 删除指定键的缓存
          return { globalCache: newCache }
        })
      },

      /**
       * 按类型清除全局缓存
       * 清除所有以指定类型开头的缓存项
       */
      clearGlobalCacheByType: (type: string) => {
        const prefix = `${type}:`
        set((state) => {
          const newCache = { ...state.globalCache }
          // 清除数据缓存中匹配类型的项
          Object.keys(newCache).forEach((key) => {
            if (key.startsWith(prefix)) {
              delete newCache[key]
            }
          })
          return { globalCache: newCache }
        })
      },

      /**
       * 按ID清除全局缓存
       * 清除所有以指定ID结尾的缓存项
       */
      clearGlobalCacheById: (id: string) => {
        set((state) => {
          const newCache = { ...state.globalCache }
          // 清除数据缓存中匹配ID的项
          Object.keys(newCache).forEach((key) => {
            if (key.endsWith(`:${id}`)) {
              delete newCache[key]
            }
          })
          return { globalCache: newCache }
        })
      },

      /**
       * 清除指定键的Promise缓存
       * 删除进行中的Promise引用
       */
      clearGlobalCachePromise: (key: string) => {
        set((state) => {
          const newPromiseCache = { ...state.globalPromiseCache }
          delete newPromiseCache[key] // 删除指定键的Promise缓存
          return { globalPromiseCache: newPromiseCache }
        })
      },

      /**
       * Supabase请求缓存
       * 为Supabase API请求提供缓存机制，避免重复请求
       */
      cacheSupabaseRequest: async <T>(url: string, fetchFunction: () => Promise<T>) => {
        // 使用URL作为缓存键
        const cacheKey = `supabase:${url}`

        // 检查缓存
        const cached = get().getFromGlobalCache<T>(cacheKey)

        // 如果有有效缓存数据，直接返回
        if (cached.data) {
          return cached.data
        }

        // 如果有进行中的请求，返回现有Promise
        if (cached.promise) {
          return cached.promise
        }

        // 创建新的获取Promise
        const fetchPromise = (async () => {
          try {
            // 执行实际的获取函数
            const result = await fetchFunction()

            // 设置缓存
            get().setGlobalCache(cacheKey, result)
            return result
          } finally {
            // 请求完成后清除Promise引用
            get().clearGlobalCachePromise(cacheKey)
          }
        })()

        // 存储Promise以便去重
        get().setGlobalCachePromise(cacheKey, fetchPromise)
        return fetchPromise
      },

      /**
       * 清除URL缓存
       * 删除指定URL的缓存数据
       */
      clearUrlCache: (url: string) => {
        const cacheKey = `supabase:${url}` // 生成URL缓存键
        get().clearGlobalCache(cacheKey) // 清除对应缓存
      },

      /**
       * 判断错误是否为用户未登录错误
       * 更严谨的错误类型检查，支持多种错误格式
       */
      isUserNotLoggedInError: (error: any): boolean => {
        if (!error) return false
        
        // 检查错误消息内容
        const errorMessage = error.message || error.error_description || error.msg || ''
        const lowerMessage = errorMessage.toLowerCase()
        
        // 定义常见的未登录错误消息模式
        const notLoggedInPatterns = [
          '用户未登录', // 中文错误消息
          'user not logged in', // 英文错误消息
          'not authenticated', // 未认证
          'authentication required', // 需要认证
          'unauthorized', // 未授权
          'invalid jwt', // 无效JWT
          'jwt expired', // JWT过期
          'no user found' // 未找到用户
        ]
        
        // 检查错误消息是否包含未登录相关模式
        const hasNotLoggedInMessage = notLoggedInPatterns.some(pattern => 
          lowerMessage.includes(pattern)
        )
        
        // 定义Supabase特定的认证错误代码
        const supabaseAuthErrors = [
          'PGRST301', // JWT过期
          'PGRST302', // JWT无效
          '401'       // HTTP 401未授权
        ]
        
        // 检查是否包含Supabase认证错误代码
        const hasAuthErrorCode = supabaseAuthErrors.some(code => 
          error.code === code || error.status === code || error.statusCode === code
        )
        
        // 检查特殊情况：getCurrentUser返回null或认证错误
        const isNullUser = error.type === 'user_not_found' || 
                          (error.name === 'AuthError' && !error.user)
        
        // 综合判断：满足任一条件即为未登录错误
        return hasNotLoggedInMessage || hasAuthErrorCode || isNullUser
      },

      /**
       * 格式化错误消息
       * 将技术性错误转换为用户友好的提示信息
       */
      formatErrorMessage: (error: any): string => {
        if (!error) return '未知错误'
        
        // 优先使用自定义错误消息（通常最准确）
        if (error.message) {
          return error.message
        }
        
        // Supabase特定的错误描述格式
        if (error.error_description) {
          return error.error_description
        }
        
        // 网络连接错误
        if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
          return '网络连接失败，请检查网络设置'
        }
        
        // 请求超时错误
        if (error.name === 'TimeoutError' || error.code === 'TIMEOUT') {
          return '请求超时，请稍后重试'
        }
        
        // 服务器内部错误（5xx状态码）
        if (error.status >= 500 || error.statusCode >= 500) {
          return '服务器暂时不可用，请稍后重试'
        }
        
        // 权限不足错误（403状态码）
        if (error.status === 403 || error.statusCode === 403) {
          return '权限不足，无法执行此操作'
        }
        
        // 兜底错误消息（使用其他可能的错误字段）
        return error.msg || error.details || '获取设置失败'
      },
    }),
    {
      // Zustand持久化配置
      name: 'settings-storage', // 本地存储键名
      
      /**
       * 持久化状态选择器
       * 只保存核心设置数据，排除临时状态和缓存数据
       */
      partialize: (state) => ({
        apiKey: state.apiKey,
        currency: state.currency,
        theme: state.theme,
        showOriginalCurrency: state.showOriginalCurrency,
        notifications: state.notifications,
        userSettingsCache: state.userSettingsCache,
        userSettingsCacheTimestamp: state.userSettingsCacheTimestamp,
        exchangeRates: state.exchangeRates,
        lastExchangeRateUpdate: state.lastExchangeRateUpdate
      })
    }
  )
)