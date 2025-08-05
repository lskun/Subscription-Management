import { useState, useEffect, useRef, useCallback } from 'react'
import { subscriptionsEdgeFunctionService, SubscriptionsRequest, SubscriptionsResponse, SubscriptionData } from '@/services/subscriptionsEdgeFunctionService'
import { useSettingsStore } from '@/store/settingsStore'

export interface SubscriptionsFilters {
  status?: 'all' | 'active' | 'cancelled'
  categories?: string[]
  billingCycles?: string[]
  searchTerm?: string
}

export interface SubscriptionsSorting {
  field?: 'nextBillingDate' | 'name' | 'amount'
  order?: 'asc' | 'desc'
}

export function useSubscriptionsData() {
  const { currency: userCurrency } = useSettingsStore()
  
  const [subscriptionsData, setSubscriptionsData] = useState<SubscriptionsResponse>({
    subscriptions: [],
    categories: [],
    paymentMethods: [],
    summary: {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      cancelledSubscriptions: 0,
      totalMonthlySpending: 0,
      totalYearlySpending: 0
    },
    currency: 'CNY',
    timestamp: ''
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasInitialized = useRef(false)
  const currentFilters = useRef<SubscriptionsFilters>({})
  const currentSorting = useRef<SubscriptionsSorting>({ field: 'nextBillingDate', order: 'asc' })

  const fetchSubscriptionsData = useCallback(async (
    currency?: string,
    filters?: SubscriptionsFilters,
    sorting?: SubscriptionsSorting
  ) => {
    const targetCurrency = currency || userCurrency || 'CNY'
    const requestFilters = filters || currentFilters.current
    const requestSorting = sorting || currentSorting.current
    
    setIsLoading(true)
    setError(null)

    try {
      console.log('🔄 获取Subscriptions数据...', { 
        targetCurrency, 
        filters: requestFilters, 
        sorting: requestSorting 
      })
      
      const edgeFunctionData = await subscriptionsEdgeFunctionService.getSubscriptionsData({
        targetCurrency,
        includeCategories: true,
        includePaymentMethods: true,
        filters: requestFilters,
        sorting: requestSorting
      })

      setSubscriptionsData(edgeFunctionData)
      currentFilters.current = requestFilters
      currentSorting.current = requestSorting
      hasInitialized.current = true
      console.log('✅ Subscriptions数据获取完成')
    } catch (err: any) {
      console.error('❌ Subscriptions数据获取失败:', err)
      setError(err.message || '获取Subscriptions数据失败')
    } finally {
      setIsLoading(false)
    }
  }, [userCurrency])

  const refreshData = useCallback(async () => {
    // Clear cache before refresh
    subscriptionsEdgeFunctionService.clearCache()
    hasInitialized.current = false
    await fetchSubscriptionsData()
  }, [fetchSubscriptionsData])

  const updateFilters = useCallback(async (filters: SubscriptionsFilters) => {
    await fetchSubscriptionsData(undefined, filters, currentSorting.current)
  }, [fetchSubscriptionsData])

  const updateSorting = useCallback(async (sorting: SubscriptionsSorting) => {
    await fetchSubscriptionsData(undefined, currentFilters.current, sorting)
  }, [fetchSubscriptionsData])

  const searchSubscriptions = useCallback(async (searchTerm: string) => {
    const newFilters = { ...currentFilters.current, searchTerm }
    await fetchSubscriptionsData(undefined, newFilters, currentSorting.current)
  }, [fetchSubscriptionsData])

  const filterByStatus = useCallback(async (status: 'all' | 'active' | 'cancelled') => {
    const newFilters = { ...currentFilters.current, status }
    await fetchSubscriptionsData(undefined, newFilters, currentSorting.current)
  }, [fetchSubscriptionsData])

  const filterByCategories = useCallback(async (categories: string[]) => {
    const newFilters = { ...currentFilters.current, categories }
    await fetchSubscriptionsData(undefined, newFilters, currentSorting.current)
  }, [fetchSubscriptionsData])

  const filterByBillingCycles = useCallback(async (billingCycles: string[]) => {
    const newFilters = { ...currentFilters.current, billingCycles }
    await fetchSubscriptionsData(undefined, newFilters, currentSorting.current)
  }, [fetchSubscriptionsData])

  const clearCache = useCallback(() => {
    subscriptionsEdgeFunctionService.clearCache()
  }, [])

  // 本地更新订阅数据，避免重新获取
  const updateLocalSubscription = useCallback((updatedSubscription: SubscriptionData) => {
    setSubscriptionsData(prevData => ({
      ...prevData,
      subscriptions: prevData.subscriptions.map(sub => 
        sub.id === updatedSubscription.id ? updatedSubscription : sub
      )
    }))
  }, [])

  // 本地删除订阅数据，避免重新获取
  const deleteLocalSubscription = useCallback((subscriptionId: string) => {
    setSubscriptionsData(prevData => ({
      ...prevData,
      subscriptions: prevData.subscriptions.filter(sub => sub.id !== subscriptionId),
      summary: {
        ...prevData.summary,
        totalSubscriptions: prevData.summary.totalSubscriptions - 1,
        activeSubscriptions: prevData.subscriptions.find(sub => sub.id === subscriptionId)?.status === 'active' 
          ? prevData.summary.activeSubscriptions - 1 
          : prevData.summary.activeSubscriptions,
        cancelledSubscriptions: prevData.subscriptions.find(sub => sub.id === subscriptionId)?.status === 'cancelled'
          ? prevData.summary.cancelledSubscriptions - 1
          : prevData.summary.cancelledSubscriptions
      }
    }))
  }, [])

  // 本地添加订阅数据，避免重新获取
  const addLocalSubscription = useCallback((newSubscription: SubscriptionData) => {
    setSubscriptionsData(prevData => ({
      ...prevData,
      subscriptions: [...prevData.subscriptions, newSubscription],
      summary: {
        ...prevData.summary,
        totalSubscriptions: prevData.summary.totalSubscriptions + 1,
        activeSubscriptions: newSubscription.status === 'active' 
          ? prevData.summary.activeSubscriptions + 1 
          : prevData.summary.activeSubscriptions,
        cancelledSubscriptions: newSubscription.status === 'cancelled'
          ? prevData.summary.cancelledSubscriptions + 1
          : prevData.summary.cancelledSubscriptions
      }
    }))
  }, [])

  // Initial data fetch
  useEffect(() => {
    if (!hasInitialized.current && userCurrency) {
      fetchSubscriptionsData()
    }
  }, [userCurrency, fetchSubscriptionsData])

  // Update data when currency changes (after initial load)
  useEffect(() => {
    if (hasInitialized.current && userCurrency) {
      console.log('💱 货币变化，更新Subscriptions数据:', userCurrency)
      fetchSubscriptionsData()
    }
  }, [userCurrency, fetchSubscriptionsData])

  return {
    // Data
    subscriptionsData,
    subscriptions: subscriptionsData.subscriptions,
    categories: subscriptionsData.categories || [],
    paymentMethods: subscriptionsData.paymentMethods || [],
    summary: subscriptionsData.summary,
    
    // State
    isLoading,
    error,
    hasInitialized: hasInitialized.current,
    
    // Current filters and sorting
    currentFilters: currentFilters.current,
    currentSorting: currentSorting.current,
    
    // Actions
    fetchSubscriptionsData,
    refreshData,
    updateFilters,
    updateSorting,
    searchSubscriptions,
    filterByStatus,
    filterByCategories,
    filterByBillingCycles,
    clearCache,
    
    // Local state updates
    updateLocalSubscription,
    deleteLocalSubscription,
    addLocalSubscription
  }
}