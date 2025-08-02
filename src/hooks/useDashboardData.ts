import { useState, useEffect, useRef } from 'react'
import { dashboardEdgeFunctionService } from '@/services/dashboardEdgeFunctionService'
import { useSettingsStore } from '@/store/settingsStore'

export interface DashboardData {
  monthlySpending: number
  yearlySpending: number
  activeSubscriptions: number
  upcomingRenewals: Array<{
    id: string
    name: string
    plan?: string
    amount: number
    currency: string
    originalAmount?: number // 原始金额
    originalCurrency?: string // 原始货币
    nextBillingDate: string
    billingCycle: string
    status: 'active'
  }>
  recentlyPaid: Array<{
    id: string
    name: string
    plan?: string
    amount: number
    currency: string
    originalAmount?: number // 原始金额
    originalCurrency?: string // 原始货币
    lastBillingDate: string
    billingCycle: string
    status: 'active'
  }>
  categoryBreakdown: Array<{
    category: string
    label: string
    amount: number
    percentage: number
    subscriptionCount: number
  }>
}

export function useDashboardData() {
  const { currency: userCurrency } = useSettingsStore()
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    monthlySpending: 0,
    yearlySpending: 0,
    activeSubscriptions: 0,
    upcomingRenewals: [],
    recentlyPaid: [],
    categoryBreakdown: []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasInitialized = useRef(false)

  const fetchDashboardData = async (currency?: string) => {
    const targetCurrency = currency || userCurrency || 'CNY'
    setIsLoading(true)
    setError(null)

    try {
      console.log('🔄 获取Dashboard数据...', { targetCurrency })
      
      const edgeFunctionData = await dashboardEdgeFunctionService.getDashboardAnalytics({
        targetCurrency,
        includeUpcomingRenewals: true,
        includeRecentlyPaid: true,
        includeCategoryBreakdown: true
      })

      const transformedData: DashboardData = {
        monthlySpending: edgeFunctionData.monthlySpending,
        yearlySpending: edgeFunctionData.yearlySpending,
        activeSubscriptions: edgeFunctionData.activeSubscriptions,
        upcomingRenewals: edgeFunctionData.upcomingRenewals?.map(renewal => ({
          id: renewal.id,
          name: renewal.name,
          plan: renewal.billing_cycle, // Use billing cycle as plan fallback
          amount: renewal.convertedAmount || renewal.amount, // 使用转换后的金额
          currency: targetCurrency, // 使用目标货币
          originalAmount: renewal.amount, // 保存原始金额
          originalCurrency: renewal.currency, // 保存原始货币
          nextBillingDate: renewal.next_billing_date,
          billingCycle: renewal.billing_cycle,
          status: 'active' as const
        })) || [],
        recentlyPaid: edgeFunctionData.recentlyPaid?.map(payment => ({
          id: payment.id,
          name: payment.name,
          plan: payment.billing_cycle, // Use billing cycle as plan fallback
          amount: payment.convertedAmount || payment.amount, // 使用转换后的金额
          currency: targetCurrency, // 使用目标货币
          originalAmount: payment.amount, // 保存原始金额
          originalCurrency: payment.currency, // 保存原始货币
          lastBillingDate: payment.last_billing_date,
          billingCycle: payment.billing_cycle,
          status: 'active' as const
        })) || [],
        categoryBreakdown: edgeFunctionData.categoryBreakdown || []
      }

      setDashboardData(transformedData)
      hasInitialized.current = true
      console.log('✅ Dashboard数据获取完成')
    } catch (err: any) {
      console.error('❌ Dashboard数据获取失败:', err)
      setError(err.message || '获取Dashboard数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshData = async () => {
    // Clear cache before refresh
    dashboardEdgeFunctionService.clearCache()
    hasInitialized.current = false
    await fetchDashboardData()
  }

  const clearCache = () => {
    dashboardEdgeFunctionService.clearCache()
  }

  // Initial data fetch
  useEffect(() => {
    if (!hasInitialized.current && userCurrency) {
      fetchDashboardData()
    }
  }, [userCurrency])

  // Update data when currency changes (after initial load)
  useEffect(() => {
    if (hasInitialized.current && userCurrency) {
      console.log('💱 货币变化，更新Dashboard数据:', userCurrency)
      fetchDashboardData()
    }
  }, [userCurrency])

  return {
    dashboardData,
    isLoading,
    error,
    hasInitialized: hasInitialized.current,
    fetchDashboardData,
    refreshData,
    clearCache
  }
}