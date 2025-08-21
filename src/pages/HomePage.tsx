import { useState, useCallback, useMemo } from "react"
import {
  Calendar,
  Clock,
  RefreshCw,
  Crown
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { useUserPlan } from "@/hooks/usePermissionsOptimized"

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
  const { plan, loading: planLoading } = useUserPlan()
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Get the default view from settings
  const { currency: userCurrency } = useSettingsStore()
  
  // Plan information
  const isFreePlan = plan?.name === '免费版'

  const {
    bulkAddSubscriptions,
    updateSubscription,
    fetchSubscriptions
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
    console.log('🔄 Starting manual data refresh...')

    try {
      // Refresh dashboard data only (Edge Function aggregates all needed data)
      await refreshDashboardData()

      console.log('✅ Manual data refresh completed')

      toast({
        title: "Data refreshed",
        description: "Dashboard analytics have been refreshed"
      })
    } catch (error) {
      console.error('❌ Failed to refresh data:', error)
      toast({
        title: "Refresh failed",
        description: "Data refresh failed, please try again",
        variant: "destructive"
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshDashboardData, toast])



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

  // 直接传入带 label 的分类明细，避免额外 categories 查询依赖
  const categoryItems = useMemo(() => {
    return categoryBreakdown.map(c => ({ category: c.category, label: c.label, amount: c.amount }))
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
            {authLoading ? 'Verifying identity...' : 'Loading subscription data...'}
          </p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-sm text-muted-foreground mt-2">
              Development mode: React StrictMode may cause initialization to execute twice
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
          <p className="text-lg font-medium">Please sign in to view your dashboard</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            
            {/* Plan Badge */}
            {planLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            ) : (
              <Badge
                variant={isFreePlan ? "default" : "default"}
                className={isFreePlan ? "bg-green-500 text-white" : "bg-amber-500 text-white"}
              >
                {isFreePlan ? (
                  <>Free Plan</>
                ) : (
                  <>
                    <Crown className="h-3 w-3 mr-1" />
                    Premium Plan
                  </>
                )}
              </Badge>
            )}
          </div>
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

          <CategoryBreakdown items={categoryItems} />
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