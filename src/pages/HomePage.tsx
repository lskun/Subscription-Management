import { useState, useCallback, useMemo } from "react"
import {
  Calendar,
  Clock,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"

import {
  useSubscriptionStore,
  Subscription
} from "@/store/subscriptionStore"
import { useSettingsStore } from "@/store/settingsStore"
import { formatCurrencyAmount } from "@/utils/currency"
import { useDashboardData } from "@/hooks/useDashboardData"

import { SubscriptionForm } from "@/components/subscription/SubscriptionForm"
import { StatCard } from "@/components/dashboard/StatCard"
import { UpcomingRenewals } from "@/components/dashboard/UpcomingRenewals"
import { RecentlyPaid } from "@/components/dashboard/RecentlyPaid"
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown"
import { ImportModal } from "@/components/imports/ImportModal"

function HomePage() {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Get the default view from settings
  const { currency: userCurrency } = useSettingsStore()

  const {
    bulkAddSubscriptions,
    updateSubscription,
    fetchSubscriptions,
    initializeWithRenewals
  } = useSubscriptionStore()

  // Use the new dashboard data hook
  const {
    dashboardData,
    isLoading: isLoadingDashboard,
    error: dashboardError,
    hasInitialized,
    refreshData: refreshDashboardData
  } = useDashboardData()

  // Show dashboard error if any
  if (dashboardError) {
    console.error('Dashboard错误:', dashboardError)
  }

  // Handler for updating subscription (memoized)
  const handleUpdateSubscription = useCallback(async (id: string, data: Omit<Subscription, "id" | "lastBillingDate">) => {
    const { error } = await updateSubscription(id, data)

    if (error) {
      toast({
        title: "Error updating subscription",
        description: error.message || "Failed to update subscription",
        variant: "destructive"
      })
      return
    }

    setEditingSubscription(null)
    toast({
      title: "Subscription updated",
      description: `${data.name} has been updated successfully.`
    })
  }, [updateSubscription, toast])

  // Handler for manual refresh with renewals (memoized)
  const handleRefreshWithRenewals = useCallback(async () => {
    setIsRefreshing(true)
    console.log('🔄 开始手动刷新数据...')

    try {
      // Refresh subscription data with renewals
      await initializeWithRenewals()

      // Refresh dashboard data
      await refreshDashboardData()

      console.log('✅ 手动刷新完成')

      toast({
        title: "数据已刷新",
        description: "订阅数据和续费信息已更新完成"
      })
    } catch (error) {
      console.error('❌ 刷新数据失败:', error)
      toast({
        title: "刷新失败",
        description: "数据刷新失败，请重试",
        variant: "destructive"
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [initializeWithRenewals, refreshDashboardData, toast])



  // Handler for importing subscriptions (memoized)
  const handleImportSubscriptions = useCallback(async (newSubscriptions: Omit<Subscription, "id">[]) => {
    const { error } = await bulkAddSubscriptions(newSubscriptions);

    if (error) {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import subscriptions",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Import successful",
        description: `${newSubscriptions.length} subscriptions have been imported.`,
      });
    }

    // Final fetch to ensure UI is up-to-date
    fetchSubscriptions();
  }, [bulkAddSubscriptions, fetchSubscriptions, toast]);



  // All dashboard data now comes from Edge Function
  const {
    monthlySpending,
    yearlySpending,
    activeSubscriptions: activeSubscriptionsCount,
    upcomingRenewals,
    recentlyPaid: recentlyPaidSubscriptions,
    categoryBreakdown
  } = dashboardData

  // Convert categoryBreakdown to the format expected by CategoryBreakdown component
  const spendingByCategory = useMemo(() => {
    const result: Record<string, number> = {}
    categoryBreakdown.forEach(category => {
      result[category.category] = category.amount
    })
    return result
  }, [categoryBreakdown])

  // Show loading while authenticating or loading data
  // 优化加载状态：只在真正需要时显示加载界面
  const shouldShowLoading = authLoading || (isLoadingDashboard && !hasInitialized)

  if (shouldShowLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-16rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">
            {authLoading ? '正在验证身份...' : '正在加载订阅数据...'}
          </p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-sm text-muted-foreground mt-2">
              开发模式：React StrictMode可能会导致初始化执行两次
            </p>
          )}
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-16rem)]">
        <div className="text-center">
          <p className="text-lg font-medium">请登录以查看您的仪表板</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your subscription expenses and activity
          </p>
        </div>
        <Button
          onClick={handleRefreshWithRenewals}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {/* Dashboard Content */}
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Monthly Spending"
            value={formatCurrencyAmount(monthlySpending, userCurrency || 'CNY')}
            description="Current month expenses"
            icon={Calendar}
            iconColor="text-blue-500"
          />
          <StatCard
            title="Yearly Spending"
            value={formatCurrencyAmount(yearlySpending, userCurrency || 'CNY')}
            description="Current year total expenses"
            icon={Calendar}
            iconColor="text-purple-500"
          />
          <StatCard
            title="Active Subscriptions"
            value={activeSubscriptionsCount.toString()}
            description="Total services"
            icon={Clock}
            iconColor="text-green-500"
          />
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          <RecentlyPaid
            subscriptions={recentlyPaidSubscriptions}
          />

          <UpcomingRenewals
            subscriptions={upcomingRenewals}
          />

          <CategoryBreakdown data={spendingByCategory} />
        </div>
      </div>



      {/* Forms and Modals */}
      {editingSubscription && (
        <SubscriptionForm
          open={Boolean(editingSubscription)}
          onOpenChange={() => setEditingSubscription(null)}
          initialData={editingSubscription}
          onSubmit={(data) => handleUpdateSubscription(editingSubscription.id, data)}
        />
      )}

      <ImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleImportSubscriptions}
      />
    </>
  )
}

export default HomePage