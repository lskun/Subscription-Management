import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSubscriptionStore } from "@/store/subscriptionStore"
import { useSettingsStore } from "@/store/settingsStore" 
import { usePermissions, useUserPlan } from '@/hooks/usePermissions'
import { Permission } from '@/services/userPermissionService'
import { getDateRangePresets } from "@/lib/expense-analytics"
import { useExpenseReportsData } from "@/hooks/useExpenseReportsData"

// 组件导入
import { ExpenseTrendChart } from "@/components/charts/ExpenseTrendChart"
import { YearlyTrendChart } from "@/components/charts/YearlyTrendChart"
import { CategoryPieChart } from "@/components/charts/CategoryPieChart"
import { ExpenseInfoCards, ExpenseInfoData as UIExpenseInfoData } from "@/components/charts/ExpenseInfoCards"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lock, Crown, TrendingUp, BarChart3, PieChart } from 'lucide-react'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ExpenseInfoData as ServiceExpenseInfoData, MonthlyExpense as ServiceMonthlyExpense, YearlyExpense as ServiceYearlyExpense, CategoryExpense as ServiceCategoryExpense } from "@/services/expenseReportsEdgeFunctionService"
import { MonthlyExpense as UIMonthlyExpense, YearlyExpense as UIYearlyExpense, CategoryExpense as UICategoryExpense } from "@/services/supabaseAnalyticsService"

// 类型适配器函数
const adaptExpenseInfoData = (data: ServiceExpenseInfoData[], periodType: 'monthly' | 'quarterly' | 'yearly'): UIExpenseInfoData[] => {
  return data.map(item => ({
    period: item.period,
    periodType,
    totalSpent: item.amount,
    dailyAverage: periodType === 'monthly' ? item.amount / 30 : periodType === 'quarterly' ? item.amount / 90 : item.amount / 365,
    activeSubscriptions: 0, // Edge function doesn't provide this, set to 0
    paymentCount: item.paymentCount || 0,
    startDate: item.period,
    endDate: item.period,
    currency: item.currency
  }))
}

// 适配月度费用数据
const adaptMonthlyExpenseData = (data: ServiceMonthlyExpense[]): UIMonthlyExpense[] => {
  return data.map(item => ({
    monthKey: `${item.year}-${String(new Date(item.month + ' 1, 2000').getMonth() + 1).padStart(2, '0')}`,
    month: item.month,
    year: item.year,
    amount: item.total,
    subscriptionCount: item.activeSubscriptionCount || 0
  }))
}

// 适配年度费用数据
const adaptYearlyExpenseData = (data: ServiceYearlyExpense[]): UIYearlyExpense[] => {
  return data.map(item => ({
    year: item.year,
    amount: item.total,
    subscriptionCount: item.activeSubscriptionCount || 0
  }))
}

// 适配分类费用数据
const adaptCategoryExpenseData = (data: ServiceCategoryExpense[]): UICategoryExpense[] => {
  const totalAmount = data.reduce((sum, item) => sum + item.total, 0)
  return data.map(item => ({
    category: item.category,
    amount: item.total,
    percentage: totalAmount > 0 ? (item.total / totalAmount) * 100 : 0,
    subscriptionCount: item.subscriptionCount
  }))
}

/**
 * 权限控制的费用报告页面组件
 * 根据用户订阅计划显示不同的功能
 */
export function PermissionControlledExpenseReports() {
  const subscriptionStore = useSubscriptionStore()
  const settingsStore = useSettingsStore()
  const { fetchCategories } = subscriptionStore
  const { fetchSettings, currency: userCurrency } = settingsStore
  
  // 权限检查
  const { plan, loading: planLoading, isFreePlan } = useUserPlan()
  const monthlyPermission = usePermissions([Permission.VIEW_MONTHLY_EXPENSES])
  const quarterlyPermission = usePermissions([Permission.VIEW_QUARTERLY_EXPENSES])
  const yearlyPermission = usePermissions([Permission.VIEW_YEARLY_EXPENSES])
  const categoryPermission = usePermissions([Permission.VIEW_CATEGORY_EXPENSES])
  const advancedPermission = usePermissions([Permission.VIEW_ADVANCED_ANALYTICS])

  // Filter states
  const [selectedDateRange] = useState('Last 12 Months')

  // 初始化数据
  const initializeData = useCallback(async () => {
    await Promise.all([
      fetchCategories(),
      fetchSettings()
    ])
  }, [fetchCategories, fetchSettings])

  useEffect(() => {
    initializeData()
  }, [initializeData])

  // 日期范围设置
  const dateRangePresets = useMemo(() => getDateRangePresets(), [])
  const currentDateRange = useMemo(() => {
    return dateRangePresets.find(preset => preset.label === selectedDateRange)
      || dateRangePresets[2] // Default to Last 12 Months
  }, [selectedDateRange, dateRangePresets])

  const yearlyDateRangePresets = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    return [{
      label: `${currentYear - 2} - ${currentYear}`,
      startDate: new Date(currentYear - 2, 0, 1),
      endDate: new Date(currentYear, currentMonth, new Date(currentYear, currentMonth + 1, 0).getDate())
    }]
  }, [])

  const currentYearlyDateRange = useMemo(() => {
    return yearlyDateRangePresets[0]
  }, [yearlyDateRangePresets])

  // 根据权限控制获取的数据参数
  const dataRequestParams = useMemo(() => ({
    includeMonthlyExpenses: monthlyPermission.hasPermission(Permission.VIEW_MONTHLY_EXPENSES),
    includeQuarterlyExpenses: quarterlyPermission.hasPermission(Permission.VIEW_QUARTERLY_EXPENSES),  
    includeYearlyExpenses: yearlyPermission.hasPermission(Permission.VIEW_YEARLY_EXPENSES),
    includeCategoryExpenses: categoryPermission.hasPermission(Permission.VIEW_CATEGORY_EXPENSES),
    includeAdvancedAnalytics: advancedPermission.hasPermission(Permission.VIEW_ADVANCED_ANALYTICS)
  }), [monthlyPermission, quarterlyPermission, yearlyPermission, categoryPermission, advancedPermission])

  // 获取费用数据
  const {
    monthlyExpenses,
    yearlyExpenses, 
    categoryExpenses,
    monthlyCategoryExpenses,
    expenseInfo: rawExpenseInfoData,
    isLoading,
    error: expenseDataError,
    refetch
  } = useExpenseReportsData({
    monthlyRange: currentDateRange,
    yearlyRange: currentYearlyDateRange,
    currency: userCurrency,
    requestParams: dataRequestParams
  })

  // 升级提示组件
  const UpgradePrompt = ({ feature }: { feature: string }) => (
    <Card className="border-dashed border-amber-200">
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <Lock className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2 text-amber-700">
          {feature} - Premium Feature
        </h3>
        <p className="text-muted-foreground mb-4 max-w-md">
          Upgrade to Premium plan to unlock {feature} and get more comprehensive data analysis features.
        </p>
        <Button className="bg-amber-500 hover:bg-amber-600">
          <Crown className="h-4 w-4 mr-2" />
          Upgrade to Premium
        </Button>
      </CardContent>
    </Card>
  )

  // 计划信息显示
  const PlanBadge = () => (
    <div className="flex items-center gap-2 mb-4">
      <Badge 
        variant={isFreePlan ? "secondary" : "default"} 
        className={isFreePlan ? "" : "bg-amber-500 text-white"}
      >
        {isFreePlan ? (
          <>免费版</>
        ) : (
          <>
            <Crown className="h-3 w-3 mr-1" />
            Premium版
          </>
        )}
      </Badge>
      {plan && (
        <span className="text-sm text-muted-foreground">
          Subscription limit: {plan.quotas.max_subscriptions}
        </span>
      )}
    </div>
  )

  if (planLoading || monthlyPermission.loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading permissions...</p>
        </div>
      </div>
    )
  }

  if (expenseDataError) {
    return (
      <Alert>
        <AlertDescription>
          Failed to load expense data: {expenseDataError}
          <Button onClick={refetch} variant="outline" size="sm" className="ml-2">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Reports</h1>
          <p className="text-muted-foreground">Analyze your subscription expense trends and patterns</p>
        </div>
        <PlanBadge />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      <Tabs defaultValue="monthly" className="space-y-6">
        <TabsList>
          <TabsTrigger value="monthly" disabled={!monthlyPermission.hasPermission(Permission.VIEW_MONTHLY_EXPENSES)}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Monthly Analysis
            {!monthlyPermission.hasPermission(Permission.VIEW_MONTHLY_EXPENSES) && <Lock className="h-3 w-3 ml-1" />}
          </TabsTrigger>
          <TabsTrigger value="quarterly" disabled={!quarterlyPermission.hasPermission(Permission.VIEW_QUARTERLY_EXPENSES)}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Quarterly Analysis
            {!quarterlyPermission.hasPermission(Permission.VIEW_QUARTERLY_EXPENSES) && <Lock className="h-3 w-3 ml-1" />}
          </TabsTrigger>
          <TabsTrigger value="yearly" disabled={!yearlyPermission.hasPermission(Permission.VIEW_YEARLY_EXPENSES)}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Yearly Analysis
            {!yearlyPermission.hasPermission(Permission.VIEW_YEARLY_EXPENSES) && <Lock className="h-3 w-3 ml-1" />}
          </TabsTrigger>
          <TabsTrigger value="category" disabled={!categoryPermission.hasPermission(Permission.VIEW_CATEGORY_EXPENSES)}>
            <PieChart className="h-4 w-4 mr-2" />
            Category Analysis
            {!categoryPermission.hasPermission(Permission.VIEW_CATEGORY_EXPENSES) && <Lock className="h-3 w-3 ml-1" />}
          </TabsTrigger>
        </TabsList>

        {/* 费用概览信息卡片 - 所有用户都可以看到基础信息 */}
        {rawExpenseInfoData && (
          <ExpenseInfoCards 
            monthlyData={adaptExpenseInfoData(rawExpenseInfoData.monthly, 'monthly')}
            quarterlyData={adaptExpenseInfoData(rawExpenseInfoData.quarterly, 'quarterly')}
            yearlyData={adaptExpenseInfoData(rawExpenseInfoData.yearly, 'yearly')}
            currency={userCurrency}
            hasMonthlyPermission={monthlyPermission.hasPermission(Permission.VIEW_MONTHLY_EXPENSES)}
            hasQuarterlyPermission={quarterlyPermission.hasPermission(Permission.VIEW_QUARTERLY_EXPENSES)}
            hasYearlyPermission={yearlyPermission.hasPermission(Permission.VIEW_YEARLY_EXPENSES)}
          />
        )}

        {/* 月度分析 */}
        <TabsContent value="monthly" className="space-y-6">
          {monthlyPermission.hasPermission(Permission.VIEW_MONTHLY_EXPENSES) ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Expense Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthlyExpenses && monthlyExpenses.length > 0 ? (
                    <ExpenseTrendChart 
                      data={adaptMonthlyExpenseData(monthlyExpenses)} 
                      currency={userCurrency}
                    />
                  ) : (
                    <p className="text-center text-muted-foreground p-4">No monthly expense data available</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <UpgradePrompt feature="Monthly Expense Analysis" />
          )}
        </TabsContent>

        {/* 季度分析 */}
        <TabsContent value="quarterly" className="space-y-6">
          {quarterlyPermission.hasPermission(Permission.VIEW_QUARTERLY_EXPENSES) ? (
            <Card>
              <CardHeader>
                <CardTitle>Quarterly Expense Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground p-4">Quarterly analysis feature in development</p>
              </CardContent>
            </Card>
          ) : (
            <UpgradePrompt feature="Quarterly Expense Analysis" />
          )}
        </TabsContent>

        {/* 年度分析 */}
        <TabsContent value="yearly" className="space-y-6">
          {yearlyPermission.hasPermission(Permission.VIEW_YEARLY_EXPENSES) ? (
            <Card>
              <CardHeader>
                <CardTitle>Yearly Expense Trends</CardTitle>
              </CardHeader>
              <CardContent>
                {yearlyExpenses && yearlyExpenses.length > 0 ? (
                  <YearlyTrendChart 
                    data={adaptYearlyExpenseData(yearlyExpenses)} 
                    currency={userCurrency}
                  />
                ) : (
                  <p className="text-center text-muted-foreground p-4">No yearly expense data available</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <UpgradePrompt feature="Yearly Expense Analysis" />
          )}
        </TabsContent>

        {/* 分类分析 */}
        <TabsContent value="category" className="space-y-6">
          {categoryPermission.hasPermission(Permission.VIEW_CATEGORY_EXPENSES) ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Category Expense Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryExpenses && categoryExpenses.length > 0 ? (
                    <CategoryPieChart 
                      data={adaptCategoryExpenseData(categoryExpenses)} 
                      currency={userCurrency}
                    />
                  ) : (
                    <p className="text-center text-muted-foreground p-4">No category expense data available</p>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Category Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthlyCategoryExpenses && monthlyCategoryExpenses.length > 0 ? (
                    <p className="text-center text-muted-foreground p-4">Monthly category trends chart in development</p>
                  ) : (
                    <p className="text-center text-muted-foreground p-4">No monthly category data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <UpgradePrompt feature="Category Expense Analysis" />
          )}
        </TabsContent>
      </Tabs>

      {/* 免费用户提示 */}
      {isFreePlan && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Crown className="h-8 w-8 text-amber-500" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 mb-1">Unlock More Features</h3>
                <p className="text-sm text-amber-700">
                  Upgrade to Premium plan to access yearly analysis, category statistics, data export, and more advanced features.
                </p>
              </div>
              <Button className="bg-amber-500 hover:bg-amber-600">
                Upgrade Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}