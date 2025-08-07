import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { convertCurrency } from '@/utils/currency'
import { useSettingsStore } from './settingsStore'
import { isSubscriptionDue, processSubscriptionRenewal } from '@/lib/subscription-utils'
import { supabaseSubscriptionService } from '@/services/supabaseSubscriptionService'
import { supabaseCategoriesService } from '@/services/supabaseCategoriesService'
import { supabasePaymentMethodsService } from '@/services/supabasePaymentMethodsService'
// Helper to calculate the last billing date from the next one
const calculateLastBillingDate = (nextBillingDate: string, billingCycle: BillingCycle): string => {
  const nextDate = new Date(nextBillingDate)
  switch (billingCycle) {
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() - 1)
      break
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() - 1)
      break
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() - 3)
      break
  }
  return nextDate.toISOString().split('T')[0]
}

export type SubscriptionStatus = 'active' | 'trial' | 'cancelled'
export type BillingCycle = 'monthly' | 'yearly' | 'quarterly'
export type RenewalType = 'auto' | 'manual'
// Updated to allow custom categories
export type SubscriptionCategory = 'video' | 'music' | 'software' | 'cloud' | 'news' | 'game' | 'other' | string

export interface Subscription {
  id: string // Changed to UUID string for Supabase
  name: string
  plan: string
  billingCycle: BillingCycle
  nextBillingDate: string
  lastBillingDate: string | null
  amount: number
  currency: string,
  convertedAmount: number
  paymentMethodId: string // Changed to UUID string for Supabase
  startDate: string
  status: SubscriptionStatus
  categoryId: string // Changed to UUID string for Supabase
  renewalType: RenewalType
  notes: string
  website?: string
  // Optional fields for display purposes (populated by joins)
  category?: CategoryOption
  paymentMethod?: PaymentMethodOption
}

// Define the structured options
interface CategoryOption {
  id: string // Changed to UUID string for Supabase
  value: string
  label: string
  is_default?: boolean
}

interface PaymentMethodOption {
  id: string // Changed to UUID string for Supabase
  value: string
  label: string
  is_default?: boolean
}

interface SubscriptionPlanOption {
  value: string
  label: string
  service?: string // Optional association with specific service
}

interface SubscriptionState {
  subscriptions: Subscription[]
  // Custom options for dropdowns
  categories: CategoryOption[]
  paymentMethods: PaymentMethodOption[]
  subscriptionPlans: SubscriptionPlanOption[]
  isLoading: boolean
  error: string | null
  // Request deduplication
  _fetchPromises: {
    subscriptions?: Promise<void>
  }
  _lastFetch: {
    subscriptions?: number
  }

  // CRUD operations
  addSubscription: (subscription: Omit<Subscription, 'id' | 'lastBillingDate'>) => Promise<{ data: Subscription | null; error: any | null }>
  bulkAddSubscriptions: (subscriptions: Omit<Subscription, 'id' | 'lastBillingDate'>[]) => Promise<{ error: any | null }>
  updateSubscription: (id: string, subscription: Partial<Subscription>) => Promise<{ error: any | null }>
  deleteSubscription: (id: string) => Promise<{ error: any | null }>
  resetSubscriptions: () => Promise<{ error: any | null }>
  fetchSubscriptions: () => Promise<void>
  fetchCategories: () => Promise<void>
  fetchPaymentMethods: () => Promise<void>

  // Renewal operations
  processAutoRenewals: (skipRefresh?: boolean) => Promise<{ processed: number; errors: number }>
  processExpiredSubscriptions: (skipRefresh?: boolean) => Promise<{ processed: number; errors: number }>
  manualRenewSubscription: (id: string) => Promise<{ error: any | null; renewalData: any | null }>

  // Combined initialization
  initializeWithRenewals: () => Promise<void>
  initializeData: () => Promise<void>

  // Option management
  addCategory: (category: CategoryOption) => Promise<void>
  editCategory: (oldValue: string, newCategory: CategoryOption) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  addPaymentMethod: (paymentMethod: PaymentMethodOption) => Promise<void>
  editPaymentMethod: (oldValue: string, newPaymentMethod: PaymentMethodOption) => Promise<void>
  deletePaymentMethod: (id: string) => Promise<void>
  addSubscriptionPlan: (plan: SubscriptionPlanOption) => void
  editSubscriptionPlan: (oldValue: string, newPlan: SubscriptionPlanOption) => void
  deleteSubscriptionPlan: (value: string) => void

  // Stats and analytics
  getTotalMonthlySpending: () => number
  getTotalYearlySpending: () => number
  getUpcomingRenewals: (days: number) => Subscription[]
  getRecentlyPaid: (days: number) => Subscription[]
  getSpendingByCategory: () => Record<string, number>

  // Get unique categories from subscriptions
  getUniqueCategories: () => CategoryOption[]
}

// Initial options (will be replaced by data from Supabase)
const initialCategories: CategoryOption[] = []
const initialPaymentMethods: PaymentMethodOption[] = []

const initialSubscriptionPlans: SubscriptionPlanOption[] = [
  { value: 'netflix-basic', label: 'Basic', service: 'Netflix' },
  { value: 'netflix-standard', label: 'Standard', service: 'Netflix' },
  { value: 'netflix-premium', label: 'Premium', service: 'Netflix' },
  { value: 'spotify-individual', label: 'Individual', service: 'Spotify' },
  { value: 'spotify-duo', label: 'Duo', service: 'Spotify' },
  { value: 'spotify-family', label: 'Family', service: 'Spotify' },
  { value: 'apple-50gb', label: '50GB Storage', service: 'iCloud' },
  { value: 'apple-200gb', label: '200GB Storage', service: 'iCloud' },
  { value: 'apple-2tb', label: '2TB Storage', service: 'iCloud' },
  { value: 'microsoft-personal', label: 'Personal', service: 'Microsoft 365' },
  { value: 'microsoft-family', label: 'Family', service: 'Microsoft 365' },
  { value: 'youtube-individual', label: 'Individual', service: 'YouTube Premium' },
  { value: 'youtube-family', label: 'Family', service: 'YouTube Premium' }
]

// Create store with persistence
const subscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      subscriptions: [],
      categories: initialCategories,
      paymentMethods: initialPaymentMethods,
      subscriptionPlans: initialSubscriptionPlans,
      isLoading: false,
      error: null,
      _fetchPromises: {},
      _lastFetch: {},

      // Fetch subscriptions from Supabase with deduplication
      fetchSubscriptions: async () => {
        const state = get()
        const now = Date.now()
        const CACHE_DURATION = 30000 // 30 seconds cache

        // Check if we have a recent fetch or ongoing request
        if (state._lastFetch.subscriptions && (now - state._lastFetch.subscriptions) < CACHE_DURATION) {
          console.log('跳过订阅数据获取，使用缓存数据')
          return // Skip if recently fetched
        }

        if (state._fetchPromises.subscriptions) {
          console.log('等待现有的订阅数据获取请求')
          return state._fetchPromises.subscriptions // Return existing promise
        }

        const fetchPromise = (async () => {
          set({ isLoading: true, error: null })
          try {
            console.log('开始获取订阅数据...')
            const subscriptions = await supabaseSubscriptionService.getAllSubscriptions()
            console.log(`成功获取 ${subscriptions.length} 条订阅数据，正在更新store...`)
            set({
              subscriptions,
              isLoading: false,
              _lastFetch: { ...get()._lastFetch, subscriptions: now }
            })
            console.log(`Store更新完成，当前订阅数: ${get().subscriptions.length}`)
          } catch (error: any) {
            console.error('Error fetching subscriptions:', error)
            set({ error: error.message, isLoading: false, subscriptions: [] })
          } finally {
            // Clear the promise after completion
            set(state => ({
              _fetchPromises: { ...state._fetchPromises, subscriptions: undefined }
            }))
          }
        })()

        set(state => ({
          _fetchPromises: { ...state._fetchPromises, subscriptions: fetchPromise }
        }))

        return fetchPromise
      },

      // Fetch categories from Supabase with deduplication
      /**
       * 获取分类数据
       * 依赖Service层的缓存机制，简化Store层逻辑
       */
      fetchCategories: async () => {
        try {
          const categories = await supabaseCategoriesService.getAllCategories()
          set({ categories })
        } catch (error) {
          console.error('Error fetching categories:', error)
          set({ categories: [] }) // 确保不为null
        }
      },

      /**
       * 获取支付方式数据
       * 依赖Service层的缓存机制，简化Store层逻辑
       */
      fetchPaymentMethods: async () => {
        try {
          const paymentMethods = await supabasePaymentMethodsService.getAllPaymentMethods()
          set({ paymentMethods })
        } catch (error) {
          console.error('Error fetching payment methods:', error)
          set({ paymentMethods: [] }) // 确保不为null
        }
      },

      // Add a new subscription
      addSubscription: async (subscription) => {
        try {
          const newSubscription = await supabaseSubscriptionService.createSubscription(subscription)
          // Clear analytics cache since data has changed
          const { dashboardAnalyticsService } = await import('@/services/dashboardAnalyticsService')
          dashboardAnalyticsService.clearCache()
          // 强制清除缓存并重新获取数据
          set(state => ({
            _lastFetch: { ...state._lastFetch, subscriptions: undefined },
            _fetchPromises: { ...state._fetchPromises, subscriptions: undefined }
          }))
          // Refetch all subscriptions to get the updated list
          await get().fetchSubscriptions()
          return { data: newSubscription, error: null }
        } catch (error: any) {
          console.error('Error adding subscription:', error)
          set({ error: error.message })
          return { data: null, error }
        }
      },

      // Bulk add subscriptions
      bulkAddSubscriptions: async (subscriptions) => {
        try {
          await supabaseSubscriptionService.bulkCreateSubscriptions(subscriptions)
          await get().fetchSubscriptions()
          return { error: null }
        } catch (error: any) {
          console.error('Error bulk adding subscriptions:', error)
          set({ error: error.message })
          return { error }
        }
      },

      // Update an existing subscription
      updateSubscription: async (id, updatedSubscription) => {
        try {
          await supabaseSubscriptionService.updateSubscription(id, updatedSubscription)
          // Clear analytics cache since data has changed
          const { dashboardAnalyticsService } = await import('@/services/dashboardAnalyticsService')
          dashboardAnalyticsService.clearCache()
          // Refetch to ensure data consistency
          await get().fetchSubscriptions()
          return { error: null }
        } catch (error: any) {
          console.error('Error updating subscription:', error)
          set({ error: error.message })
          return { error }
        }
      },

      // Delete a subscription
      deleteSubscription: async (id) => {
        try {
          await supabaseSubscriptionService.deleteSubscription(id)
          // Clear analytics cache since data has changed
          const { dashboardAnalyticsService } = await import('@/services/dashboardAnalyticsService')
          dashboardAnalyticsService.clearCache()
          // Refetch to reflect the deletion
          await get().fetchSubscriptions()
          return { error: null }
        } catch (error: any) {
          console.error('Error deleting subscription:', error)
          set({ error: error.message })
          return { error }
        }
      },

      // Reset subscriptions by calling Supabase service
      resetSubscriptions: async () => {
        try {
          await supabaseSubscriptionService.resetAllSubscriptions()
          // Refetch to ensure the UI is cleared
          await get().fetchSubscriptions()
          return { error: null }
        } catch (error: any) {
          console.error('Error resetting subscriptions:', error)
          set({ error: error.message })
          return { error }
        }
      },

      // Add a new category option
      addCategory: async (category) => {
        try {
          const { supabaseCategoriesService } = await import('@/services/supabaseCategoriesService')
          await supabaseCategoriesService.createCategory(category)
          // Refresh categories from server
          await get().fetchCategories()
        } catch (error) {
          console.error('Error adding category:', error)
          throw error
        }
      },

      // Edit a category option
      editCategory: async (oldValue, newCategory) => {
        try {
          
          // 如果newCategory包含ID，直接使用ID进行更新
          if (newCategory.id) {
            // 只更新value字段，label字段已弃用
            await supabaseCategoriesService.updateCategory(newCategory.id, {
              value: newCategory.value
            })
          } else {
            // 兼容旧的调用方式：通过value查找ID
            const existingCategory = await supabaseCategoriesService.getCategoryByValue(oldValue)
            if (!existingCategory) {
              throw new Error('分类不存在')
            }
            // 只更新value字段，label字段已弃用
            await supabaseCategoriesService.updateCategory(existingCategory.id, {
              value: newCategory.value
            })
          }
          
          // Refresh categories from server
          await get().fetchCategories()
        } catch (error) {
          console.error('Error updating category:', error)
          throw error
        }
      },

      // Delete a category option
      deleteCategory: async (id) => {
        try {
          const { supabaseCategoriesService } = await import('@/services/supabaseCategoriesService')
          await supabaseCategoriesService.deleteCategory(id)
          // Refresh categories from server
          await get().fetchCategories()
        } catch (error) {
          console.error('Error deleting category:', error)
          throw error
        }
      },

      // Add a new payment method option
      addPaymentMethod: async (paymentMethod) => {
        try {
          await supabasePaymentMethodsService.createPaymentMethod(paymentMethod)
          // Refresh payment methods from server
        } catch (error) {
          console.error('Error adding payment method:', error)
          throw error
        }
      },

      // Edit a payment method option
      editPaymentMethod: async (oldValue, newPaymentMethod) => {
        try {
          
          // 如果newPaymentMethod包含ID，直接使用ID进行更新
          if (newPaymentMethod.id) {
            // 只更新value字段，label字段已弃用
            await supabasePaymentMethodsService.updatePaymentMethod(newPaymentMethod.id, {
              value: newPaymentMethod.value
            })
          } else {
            // 兼容旧的调用方式：通过value查找ID
            const existingPaymentMethod = await supabasePaymentMethodsService.getPaymentMethodByValue(oldValue)
            if (!existingPaymentMethod) {
              throw new Error('支付方式不存在')
            }
            // 只更新value字段，label字段已弃用
            await supabasePaymentMethodsService.updatePaymentMethod(existingPaymentMethod.id, {
              value: newPaymentMethod.value
            })
          }
          
        } catch (error) {
          console.error('Error updating payment method:', error)
          throw error
        }
      },

      // Delete a payment method option
      deletePaymentMethod: async (id) => {
        try {
          await supabasePaymentMethodsService.deletePaymentMethod(id)
          // Refresh payment methods from server
        } catch (error) {
          console.error('Error deleting payment method:', error)
          throw error
        }
      },

      // Add a new subscription plan option
      addSubscriptionPlan: (plan) => set((state) => {
        if (state.subscriptionPlans.some(p => p.value === plan.value)) {
          return state; // Plan already exists
        }
        return { subscriptionPlans: [...state.subscriptionPlans, plan] };
      }),

      // Edit a subscription plan option
      editSubscriptionPlan: (oldValue, newPlan) => set((state) => {
        const index = state.subscriptionPlans.findIndex(p => p.value === oldValue);
        if (index === -1) return state; // Plan not found

        const updatedPlans = [...state.subscriptionPlans];
        updatedPlans[index] = newPlan;
        return { subscriptionPlans: updatedPlans };
      }),

      // Delete a subscription plan option
      deleteSubscriptionPlan: (value) => set((state) => {
        return { subscriptionPlans: state.subscriptionPlans.filter(p => p.value !== value) };
      }),

      // Get total monthly spending
      getTotalMonthlySpending: () => {
        const { subscriptions } = get();
        const { currency: userCurrency } = useSettingsStore.getState();

        return subscriptions
          .filter(sub => sub.status === 'active')
          .reduce((total, sub) => {
            // Ensure amount is a number
            const amount = typeof sub.amount === 'number' ? sub.amount : parseFloat(sub.amount) || 0

            // Ensure currencies are strings
            const fromCurrency = typeof sub.currency === 'string' ? sub.currency : 'CNY'
            const toCurrency = typeof userCurrency === 'string' ? userCurrency : 'CNY'

            // Convert the amount to user's preferred currency
            const convertedAmount = convertCurrency(amount, fromCurrency, toCurrency);

            switch (sub.billingCycle) {
              case 'monthly':
                return total + convertedAmount;
              case 'yearly':
                return total + (convertedAmount / 12);
              case 'quarterly':
                return total + (convertedAmount / 3);
              default:
                return total;
            }
          }, 0);
      },

      // Get total yearly spending
      getTotalYearlySpending: () => {
        const { subscriptions } = get();
        const { currency: userCurrency } = useSettingsStore.getState();

        return subscriptions
          .filter(sub => sub.status === 'active')
          .reduce((total, sub) => {
            // Ensure amount is a number
            const amount = typeof sub.amount === 'number' ? sub.amount : parseFloat(sub.amount) || 0

            // Ensure currencies are strings
            const fromCurrency = typeof sub.currency === 'string' ? sub.currency : 'CNY'
            const toCurrency = typeof userCurrency === 'string' ? userCurrency : 'CNY'

            // Convert the amount to user's preferred currency
            const convertedAmount = convertCurrency(amount, fromCurrency, toCurrency);

            switch (sub.billingCycle) {
              case 'monthly':
                return total + (convertedAmount * 12);
              case 'yearly':
                return total + convertedAmount;
              case 'quarterly':
                return total + (convertedAmount * 4);
              default:
                return total;
            }
          }, 0);
      },

      // Get upcoming renewals for the next N days
      getUpcomingRenewals: (days) => {
        const { subscriptions } = get()
        console.log(`获取未来 ${days} 天的续费提醒，总订阅数: ${subscriptions.length}`)

        const today = new Date()
        today.setHours(0, 0, 0, 0) // Set to start of day for accurate comparison
        const futureDate = new Date()
        futureDate.setDate(today.getDate() + days)
        futureDate.setHours(23, 59, 59, 999) // Set to end of day

        console.log(`日期范围: ${today.toISOString()} 到 ${futureDate.toISOString()}`)

        const upcomingRenewals = subscriptions
          .filter(sub => {
            const billingDate = new Date(sub.nextBillingDate)
            billingDate.setHours(0, 0, 0, 0) // Set to start of day for accurate comparison
            const isActive = sub.status === 'active'
            const isInRange = billingDate >= today && billingDate <= futureDate
            console.log(`订阅 ${sub.name} nextBillingDate: ${sub.nextBillingDate}, 状态: ${sub.status}, 是否在范围内: ${isInRange}`)
            return isActive && isInRange
          })
          .sort((a, b) =>
            new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime()
          )

        console.log(`找到 ${upcomingRenewals.length} 个即将续费的订阅:`, upcomingRenewals.map(s => s.name))
        return upcomingRenewals
      },

      // Get recently paid subscriptions for the last N days
      getRecentlyPaid: (days) => {
        const { subscriptions } = get()
        console.log(`获取最近 ${days} 天的支付记录，总订阅数: ${subscriptions.length}`)

        const today = new Date()
        today.setHours(23, 59, 59, 999) // Set to end of day to include today
        const pastDate = new Date()
        pastDate.setDate(today.getDate() - days)
        pastDate.setHours(0, 0, 0, 0) // Set to start of day

        console.log(`日期范围: ${pastDate.toISOString()} 到 ${today.toISOString()}`)

        const recentlyPaid = subscriptions
          .filter(sub => {
            if (!sub.lastBillingDate) {
              console.log(`订阅 ${sub.name} 没有 lastBillingDate`)
              return false
            }
            const billingDate = new Date(sub.lastBillingDate)
            billingDate.setHours(0, 0, 0, 0) // Set to start of day for accurate comparison
            const isInRange = billingDate >= pastDate && billingDate <= today
            console.log(`订阅 ${sub.name} lastBillingDate: ${sub.lastBillingDate}, 是否在范围内: ${isInRange}`)
            return isInRange
          })
          .sort((a, b) =>
            new Date(b.lastBillingDate!).getTime() - new Date(a.lastBillingDate!).getTime()
          )

        console.log(`找到 ${recentlyPaid.length} 个最近支付的订阅:`, recentlyPaid.map(s => s.name))
        return recentlyPaid
      },

      // Get spending by category
      getSpendingByCategory: () => {
        const { subscriptions, categories } = get();
        const { currency: userCurrency } = useSettingsStore.getState();

        console.log(`计算分类支出，总订阅数: ${subscriptions.length}, 分类数: ${categories.length}`)
        console.log(`用户货币: ${userCurrency}`)

        // Get all unique category IDs from subscriptions
        const uniqueCategoryIds = Array.from(new Set(subscriptions.map(sub => sub.categoryId).filter(id => id != null)));
        console.log(`唯一分类ID: ${uniqueCategoryIds.length}`, uniqueCategoryIds)

        const result = uniqueCategoryIds.reduce((acc, categoryId) => {
          const category = categories.find(cat => cat.id === categoryId);
          const categoryValue = category?.value || 'other';
          console.log(`处理分类 ${categoryId}: ${category?.label || 'Unknown'} (${categoryValue})`)

          const categorySubscriptions = subscriptions.filter(sub => sub.status === 'active' && sub.categoryId === categoryId)
          console.log(`分类 ${categoryValue} 有 ${categorySubscriptions.length} 个活跃订阅`)

          const categoryTotal = categorySubscriptions.reduce((total, sub) => {
            // Ensure amount is a number
            const amount = typeof sub.amount === 'number' ? sub.amount : parseFloat(sub.amount) || 0

            // Ensure currencies are strings
            const fromCurrency = typeof sub.currency === 'string' ? sub.currency : 'CNY'
            const toCurrency = typeof userCurrency === 'string' ? userCurrency : 'CNY'

            // Convert the amount to user's preferred currency
            const convertedAmount = convertCurrency(amount, fromCurrency, toCurrency);

            let annualAmount = 0
            switch (sub.billingCycle) {
              case 'monthly':
                annualAmount = convertedAmount * 12;
                break;
              case 'yearly':
                annualAmount = convertedAmount;
                break;
              case 'quarterly':
                annualAmount = convertedAmount * 4;
                break;
              default:
                annualAmount = 0;
            }

            console.log(`  订阅 ${sub.name}: ${amount} ${fromCurrency} -> ${convertedAmount} ${toCurrency} -> 年度: ${annualAmount}`)
            return total + annualAmount;
          }, 0);

          console.log(`分类 ${categoryValue} 总计: ${categoryTotal}`)
          acc[categoryValue] = categoryTotal;
          return acc;
        }, {} as Record<string, number>);

        console.log('分类支出结果:', result)
        return result;
      },

      // Get unique categories from actual subscriptions
      getUniqueCategories: () => {
        const { subscriptions, categories } = get()

        // Get all unique category IDs from subscriptions
        const usedCategoryIds = [...new Set(subscriptions.map(sub => sub.categoryId).filter(id => id != null))]

        // Map these to full category objects
        return usedCategoryIds.map(categoryId => {
          const existingCategory = categories.find(cat => cat.id === categoryId)
          if (existingCategory) return existingCategory

          // Fallback for categories not found in the predefined list
          return { id: categoryId, value: 'other', label: 'Other' }
        }).filter(Boolean) // Remove any null/undefined entries
      },

      // Process automatic renewals for subscriptions that are due
      // TODO: 实现基于Supabase的自动续费逻辑
      processAutoRenewals: async (skipRefresh = false) => {
        try {
          console.warn('Auto renewals not yet implemented for Supabase')
          return { processed: 0, errors: 0 }
        } catch (error: any) {
          console.error('Error processing auto renewals:', error)
          return { processed: 0, errors: 1 }
        }
      },

      // Process expired manual subscriptions
      // TODO: 实现基于Supabase的过期订阅处理逻辑
      processExpiredSubscriptions: async (skipRefresh = false) => {
        try {
          console.warn('Expired subscription processing not yet implemented for Supabase')
          return { processed: 0, errors: 0 }
        } catch (error: any) {
          console.error('Error processing expired subscriptions:', error)
          return { processed: 0, errors: 1 }
        }
      },

      // Manual renewal for a specific subscription
      // 实现基于Supabase的手动续费逻辑
      manualRenewSubscription: async (id: string) => {
        try {
          // 将调用委托给 SupabaseSubscriptionService
          const result = await supabaseSubscriptionService.manualRenewSubscription(id);
          
          if (result.error) {
            return { error: result.error, renewalData: null };
          }

          // 成功后，可以选择性地更新本地状态或触发刷新
          // get().fetchSubscriptions(); // 例如，重新获取所有订阅

          return { error: null, renewalData: result.renewalData };

        } catch (e: any) {
          return { error: e.message || 'An unknown error occurred', renewalData: null };
        }
      },

      // Simple initialization method without auto-renewals
      initializeData: async () => {
        set({ isLoading: true, error: null })
        try {
          // Fetch all data in parallel
          await Promise.all([
            get().fetchSubscriptions(),
            get().fetchCategories(),
            get().fetchPaymentMethods()
          ])
          set({ isLoading: false })
        } catch (error: any) {
          console.error('Error during initialization:', error)
          set({ error: error.message, isLoading: false })
        }
      },

      // Combined initialization method with renewals (for manual trigger)
      initializeWithRenewals: async () => {
        set({ isLoading: true, error: null })
        try {
          // First fetch all data in parallel
          await Promise.all([
            get().fetchSubscriptions(),
            get().fetchCategories(),
            get().fetchPaymentMethods()
          ])

          // Then process renewals without additional fetches
          const [autoRenewalResult, expiredResult] = await Promise.all([
            get().processAutoRenewals(true), // Skip refresh
            get().processExpiredSubscriptions(true) // Skip refresh
          ])

          // Only fetch once more if there were any changes
          if (autoRenewalResult.processed > 0 || expiredResult.processed > 0) {
            await get().fetchSubscriptions()

            if (autoRenewalResult.processed > 0) {
              console.log(`Auto-renewed ${autoRenewalResult.processed} subscription(s)`)
            }
            if (expiredResult.processed > 0) {
              console.log(`Cancelled ${expiredResult.processed} expired subscription(s)`)
            }
          }

          if (autoRenewalResult.errors > 0) {
            console.warn(`Failed to auto-renew ${autoRenewalResult.errors} subscription(s)`)
          }
          if (expiredResult.errors > 0) {
            console.warn(`Failed to cancel ${expiredResult.errors} expired subscription(s)`)
          }
          set({ isLoading: false })
        } catch (error: any) {
          console.error('Error during initialization:', error)
          set({ error: error.message, isLoading: false })
        }
      }
    }),
    {
      name: 'subscription-storage',
      // Only persist subscription plans now, categories and payment methods are fetched from API
      partialize: (state) => ({
        subscriptionPlans: state.subscriptionPlans,
      })
    }
  )
)

/**
 * 订阅管理store hook
 * @param lazyLoad - 是否启用懒加载，当为true时会自动检查并加载categories和paymentMethods
 */
export const useSubscriptionStore = (lazyLoad: boolean = false) => {
  const store = subscriptionStore()
  
  // 如果启用懒加载，检查并加载categories和paymentMethods
  if (lazyLoad) {
    const { categories, paymentMethods, fetchCategories, fetchPaymentMethods } = store


    // 懒加载categories - 利用现有的缓存机制
    if (categories.length === 0) {
      fetchCategories()
    }
    
    // 懒加载paymentMethods - 利用现有的缓存机制
    if (paymentMethods.length === 0) {
      fetchPaymentMethods()
    }
  }
  
  return store
}
