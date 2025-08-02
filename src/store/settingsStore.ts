import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabaseExchangeRateService, SupabaseExchangeRateService } from '@/services/supabaseExchangeRateService'
import { logger } from '@/utils/logger'
import { BASE_CURRENCY, DEFAULT_EXCHANGE_RATES, type CurrencyType } from '@/config/currency'
import { supabaseUserSettingsService, type ThemeType } from '@/services/supabaseUserSettingsService'

export type { ThemeType }

interface SettingsState {
  // --- Synced with Backend ---
  apiKey: string | null
  setApiKey: (apiKey: string) => void
  currency: CurrencyType
  setCurrency: (currency: CurrencyType) => Promise<void>
  theme: ThemeType
  setTheme: (theme: ThemeType) => Promise<void>
  
  // Currency display settings
  showOriginalCurrency: boolean
  setShowOriginalCurrency: (show: boolean) => void
  
  // Exchange rate settings
  exchangeRates: Record<string, number>
  updateExchangeRate: (currency: string, rate: number) => void
  lastExchangeRateUpdate: string | null
  updateLastExchangeRateUpdate: () => void
  fetchExchangeRates: () => Promise<void>
  updateExchangeRatesFromApi: () => Promise<void>
  
  // Data management
  resetSettings: () => void
  fetchSettings: () => Promise<void>
  isLoading: boolean
  error: string | null
  
  // Request deduplication
  _fetchPromise: Promise<void> | null
  _lastFetchTime: number | null
}

export const initialSettings = {
  // Synced
  apiKey: null,
  currency: BASE_CURRENCY,
  theme: 'system' as ThemeType,
  showOriginalCurrency: true,

  exchangeRates: DEFAULT_EXCHANGE_RATES,
  lastExchangeRateUpdate: null,
  isLoading: false,
  error: null,
  
  // Request deduplication
  _fetchPromise: null,
  _lastFetchTime: null
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...initialSettings,
      
      fetchSettings: async () => {
        const state = get()
        const now = Date.now()
        const CACHE_DURATION = 30000 // 30 seconds cache

        // Check if we have a recent fetch or ongoing request
        if (state._lastFetchTime && (now - state._lastFetchTime) < CACHE_DURATION) {
          console.log('跳过设置数据获取，使用缓存数据')
          return // Skip if recently fetched
        }

        if (state._fetchPromise) {
          console.log('等待现有的设置数据获取请求')
          return state._fetchPromise // Return existing promise
        }

        const fetchPromise = (async () => {
          set({ isLoading: true, error: null })
          try {
            const userSettings = await supabaseUserSettingsService.getUserSettings()
            const settings = {
              currency: userSettings.currency || initialSettings.currency,
              theme: userSettings.theme || initialSettings.theme,
              showOriginalCurrency: userSettings.show_original_currency !== undefined
                ? Boolean(userSettings.show_original_currency)
                : initialSettings.showOriginalCurrency,
            }

            set({ 
              ...settings, 
              isLoading: false,
              _lastFetchTime: now,
              _fetchPromise: null
            })
            // Don't apply theme here - let next-themes handle it

            // 注意：汇率数据现在由Edge Function处理，不需要在前端单独获取

          } catch (error: any) {
            logger.error('Error fetching settings:', error)
            
            // 如果是用户未登录错误，使用默认设置而不是设置错误状态
            if (error.message?.includes('用户未登录')) {
              logger.info('User not logged in, using default settings')
              set({ 
                ...initialSettings,
                isLoading: false,
                error: null,
                _lastFetchTime: now,
                _fetchPromise: null
              })
              // 注意：汇率数据现在由Edge Function处理，不需要在前端单独获取
            } else {
              set({ 
                error: error.message, 
                isLoading: false,
                _fetchPromise: null
              })
            }
          }
        })()

        set({ _fetchPromise: fetchPromise })
        return fetchPromise
      },
      
      setApiKey: (apiKey) => set({ apiKey }),
      
      setCurrency: async (currency) => {
        set({ currency })
        
        // Sync to Supabase
        try {
          await supabaseUserSettingsService.setCurrency(currency)
        } catch (error: any) {
          logger.error('Error saving currency setting:', error)
          // Could optionally revert the local change here
        }
      },
      
      setTheme: async (theme) => {
        set({ theme })
        // Don't apply theme here - let next-themes handle it
        // localStorage is also handled by next-themes

        // Sync to Supabase
        try {
          await supabaseUserSettingsService.setTheme(theme)
        } catch (error: any) {
          logger.error('Error saving theme setting:', error)
        }
      },


      setShowOriginalCurrency: async (showOriginalCurrency) => {
        set({ showOriginalCurrency })

        // Sync to Supabase
        try {
          await supabaseUserSettingsService.setShowOriginalCurrency(showOriginalCurrency)
        } catch (error: any) {
          logger.error('Error saving showOriginalCurrency setting:', error)
          // Could optionally revert the local change here
        }
      },

      
      updateExchangeRate: (currency, rate) => set((state) => ({
        exchangeRates: { ...state.exchangeRates, [currency]: rate }
      })),
      
      updateLastExchangeRateUpdate: () => set({
        lastExchangeRateUpdate: new Date().toISOString()
      }),

      fetchExchangeRates: async () => {
        try {
          const rates = await supabaseExchangeRateService.getLatestRates();
          const rateMap = SupabaseExchangeRateService.ratesToMap(rates);

          set({
            exchangeRates: rateMap,
            lastExchangeRateUpdate: new Date().toISOString()
          });
        } catch (error: any) {
          logger.error('Error fetching exchange rates:', error);
          // 保持现有汇率，不更新错误状态，因为这可能在后台运行
        }
      },

      updateExchangeRatesFromApi: async () => {
        try {
          // 使用Edge Function更新汇率
          const { supabase } = await import('@/lib/supabase');
          
          const { data, error } = await supabase.functions.invoke('update-exchange-rates', {
            body: {
              updateType: 'manual',
              currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']
            }
          });

          if (error) {
            throw new Error(error.message);
          }

          if (!data?.success) {
            throw new Error(data?.error || 'Update failed');
          }

          // 更新成功后重新获取汇率
          await get().fetchExchangeRates();
          
          logger.info(`Successfully updated ${data.rates_updated} exchange rates`);
        } catch (error: any) {
          logger.error('Error updating exchange rates:', error);
          set({ error: error.message });
          throw error;
        }
      },
      
      resetSettings: async () => {
        try {
          await supabaseUserSettingsService.resetAllSettings()

          // Reset local state to initial settings
          set({ ...initialSettings })
          // Don't apply theme here - let next-themes handle it

          return { error: null }
        } catch (error: any) {
          logger.error('Error resetting settings:', error)
          set({ error: error.message })
          return { error }
        }
      },
    }),
    {
      name: 'settings-storage',
      // Persist all settings except for loading/error states and internal request tracking.
      partialize: (state) => {
        const { isLoading, error, _fetchPromise, _lastFetchTime, ...rest } = state;
        // Functions are not persisted, so we don't need to omit them.
        return rest;
      }
    }
  )
)