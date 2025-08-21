import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSubscriptionStore } from "@/store/subscriptionStore"
import { useSettingsStore } from "@/store/settingsStore"
import { usePermissions, useUserPlan } from "@/hooks/usePermissionsOptimized"
import { Permission } from "@/services/userPermissionService"
import {
  getDateRangePresets
} from "@/lib/expense-analytics"

import { useExpenseReportsData } from "@/hooks/useExpenseReportsData"
import { ExpenseTrendChart } from "@/components/charts/ExpenseTrendChart"
import { YearlyTrendChart } from "@/components/charts/YearlyTrendChart"
import { CategoryPieChart } from "@/components/charts/CategoryPieChart"
import { ExpenseInfoCards } from "@/components/charts/ExpenseInfoCards"


import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lock, Crown, AlertTriangle } from 'lucide-react'


export function ExpenseReportsPage() {
  // 从 Zustand store 中获取需要的函数和状态
  const subscriptionStore = useSubscriptionStore()
  const settingsStore = useSettingsStore()
  const { fetchCategories } = subscriptionStore
  const { fetchSettings, currency: userCurrency } = settingsStore

  // 权限控制Hooks
  const { plan, isFreePlan, loading: planLoading } = useUserPlan()
  const permissions = usePermissions([
    Permission.VIEW_MONTHLY_EXPENSES,
    Permission.VIEW_QUARTERLY_EXPENSES,
    Permission.VIEW_YEARLY_EXPENSES,
    Permission.VIEW_CATEGORY_EXPENSES,
    Permission.VIEW_ADVANCED_ANALYTICS
  ])

  // Filter states
  const [selectedDateRange] = useState('Last 12 Months')
  const [selectedYearlyDateRange] = useState(() => {
    const currentYear = new Date().getFullYear()
    return `${currentYear - 2} - ${currentYear}`
  })

  // 使用 useCallback 来稳定 initializeData 函数引用
  const initializeData = useCallback(async () => {
    // 并行获取数据以避免顺序请求
    await Promise.all([
      fetchCategories(),
      fetchSettings()
    ])
  }, [fetchCategories, fetchSettings])

  // 组件挂载时获取数据
  useEffect(() => {
    initializeData()
  }, [initializeData])

  // Get date range presets
  const dateRangePresets = getDateRangePresets()
  const currentDateRange = useMemo(() => {
    return dateRangePresets.find(preset => preset.label === selectedDateRange)
      || dateRangePresets[2] // Default to Last 12 Months
  }, [selectedDateRange])

  // Get yearly date range presets (fixed recent 3 years)
  const yearlyDateRangePresets = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-11
    return [
      {
        label: `${currentYear - 2} - ${currentYear}`,
        startDate: new Date(currentYear - 2, 0, 1), // January 1st of 3 years ago
        endDate: new Date(currentYear, currentMonth, new Date(currentYear, currentMonth + 1, 0).getDate()) // Last day of current month
      }
    ]
  }, [])

  const currentYearlyDateRange = useMemo(() => {
    return yearlyDateRangePresets.find(preset => preset.label === selectedYearlyDateRange)
      || yearlyDateRangePresets[0] // Default to Recent 3 Years
  }, [selectedYearlyDateRange, yearlyDateRangePresets])

  // 根据权限动态配置数据请求参数
  const requestParams = useMemo(() => {
    // 如果权限还在加载中，返回默认参数（只获取基础信息）
    if (permissions.loading) {
      console.log('🔍 [DEBUG] Permissions loading, using default params')
      return {
        includeMonthlyExpenses: false,
        includeQuarterlyExpenses: false,
        includeYearlyExpenses: false,
        includeCategoryExpenses: false,
        includeExpenseInfo: true
      }
    }

    const params = {
      includeMonthlyExpenses: permissions.hasPermission(Permission.VIEW_MONTHLY_EXPENSES),
      includeQuarterlyExpenses: permissions.hasPermission(Permission.VIEW_QUARTERLY_EXPENSES),
      includeYearlyExpenses: permissions.hasPermission(Permission.VIEW_YEARLY_EXPENSES),
      includeCategoryExpenses: permissions.hasPermission(Permission.VIEW_CATEGORY_EXPENSES),
      includeExpenseInfo: true // 基础信息所有用户都可以看到
    }
    console.log('🔍 [DEBUG] Permissions loaded, request params:', params)
    return params
  }, [permissions])

  // 使用新的 hook 来获取所有费用报告数据
  const {
    monthlyExpenses,
    yearlyExpenses,
    categoryExpenses,
    monthlyCategoryExpenses,
    expenseInfo: rawExpenseInfoData,
    isLoading,
    error,
    refetch
  } = useExpenseReportsData({
    monthlyStartDate: currentDateRange.startDate,
    monthlyEndDate: currentDateRange.endDate,
    yearlyStartDate: currentYearlyDateRange.startDate,
    yearlyEndDate: currentYearlyDateRange.endDate,
    currency: userCurrency as string,
    ...requestParams,
    autoFetch: true
  })

  // 转换月度分类费用数据格式以匹配ExpenseTrendChart组件期望
  const adaptedMonthlyCategoryExpenses = useMemo(() => {
    return monthlyCategoryExpenses.map(expense => ({
      monthKey: expense.monthKey,
      month: expense.month,
      year: expense.year,
      categories: expense.categories || {},
      total: expense.total || 0
    }))
  }, [monthlyCategoryExpenses])

  // 转换 expenseInfo 数据格式以匹配 ExpenseInfoCards 组件的期望
  const expenseInfoData = useMemo(() => {
    if (!rawExpenseInfoData) {
      return {
        monthly: [],
        quarterly: [],
        yearly: []
      }
    }

    const convertToExpenseInfoData = (
      data: any[],
      periodType: 'monthly' | 'quarterly' | 'yearly'
    ) => {
      return data.map((item: any) => {
        // 计算日均费用
        let daysInPeriod = 30 // 默认月度
        if (periodType === 'quarterly') {
          daysInPeriod = 90
        } else if (periodType === 'yearly') {
          daysInPeriod = 365
        }

        // 计算期间的开始和结束日期
        let startDate = ''
        let endDate = ''

        if (periodType === 'monthly') {
          const [year, month] = item.period.split('-')
          startDate = `${year}-${month}-01`
          const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
          endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`
        } else if (periodType === 'quarterly') {
          const [year, quarter] = item.period.split('-Q')
          const quarterNum = parseInt(quarter)
          const startMonth = (quarterNum - 1) * 3 + 1
          const endMonth = quarterNum * 3
          startDate = `${year}-${startMonth.toString().padStart(2, '0')}-01`
          const lastDay = new Date(parseInt(year), endMonth, 0).getDate()
          endDate = `${year}-${endMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
        } else if (periodType === 'yearly') {
          startDate = `${item.period}-01-01`
          endDate = `${item.period}-12-31`
        }

        return {
          period: item.period,
          periodType,
          totalSpent: item.amount || 0,
          dailyAverage: (item.amount || 0) / daysInPeriod,
          activeSubscriptions: 0, // 暂时设为0，后续可以从其他数据源获取
          paymentCount: item.paymentCount || 0, // 使用从 Edge Function 返回的支付数量
          startDate,
          endDate,
          currency: item.currency || (userCurrency as string)
        }
      })
    }

    return {
      monthly: convertToExpenseInfoData(rawExpenseInfoData.monthly || [], 'monthly'),
      quarterly: convertToExpenseInfoData(rawExpenseInfoData.quarterly || [], 'quarterly'),
      yearly: convertToExpenseInfoData(rawExpenseInfoData.yearly || [], 'yearly')
    }
  }, [rawExpenseInfoData, userCurrency])

  // 转换数据格式以匹配图表组件的期望
  const adaptedMonthlyExpenses = useMemo(() => {
    console.log('🔍 [DEBUG] Raw monthlyExpenses:', monthlyExpenses)
    console.log('🔍 [DEBUG] monthlyExpenses length:', monthlyExpenses.length)
    const adapted = monthlyExpenses.map(expense => ({
      monthKey: expense.month,
      month: expense.month,
      year: expense.year,
      amount: expense.total,
      // 使用"活跃订阅数"：该月内发生过成功支付的订阅去重数
      subscriptionCount: (expense as any).activeSubscriptionCount || 0
    }))
    console.log('🔍 [DEBUG] Adapted monthlyExpenses:', adapted)
    return adapted
  }, [monthlyExpenses])

  const adaptedYearlyExpenses = useMemo(() => {
    return yearlyExpenses.map(expense => ({
      year: expense.year,
      amount: expense.total,
      // 使用“活跃订阅数”：该年内发生过成功支付的订阅去重数
      subscriptionCount: (expense as any).activeSubscriptionCount || 0
    }))
  }, [yearlyExpenses])

  const adaptedCategoryExpenses = useMemo(() => {
    return categoryExpenses.map(expense => ({
      category: expense.category,
      amount: expense.total,
      percentage: 0, // 需要计算百分比
      subscriptionCount: expense.subscriptionCount
    }))
  }, [categoryExpenses])

  // 计算分类费用的百分比
  const categoryExpensesWithPercentage = useMemo(() => {
    const total = adaptedCategoryExpenses.reduce((sum, item) => sum + item.amount, 0)
    return adaptedCategoryExpenses.map(item => ({
      ...item,
      percentage: total > 0 ? (item.amount / total) * 100 : 0
    }))
  }, [adaptedCategoryExpenses])

  // 计算所有月度费用的总和
  const totalMonthlyAmount = useMemo(() => {
    return adaptedMonthlyExpenses.reduce((sum, item) => sum + item.amount, 0)
  }, [adaptedMonthlyExpenses])

  // 为了兼容现有组件，创建一些别名和数据映射






  const yearlyGroupedCategoryExpenses: any[] = []

  // 加载状态别名
  const isLoadingExpenses = isLoading
  const isLoadingYearlyExpenses = isLoading
  const isLoadingCategoryExpenses = isLoading
  const isLoadingYearlyCategoryExpenses = isLoading
  const isLoadingExpenseInfo = isLoading

  // 错误状态别名
  const expenseError = error
  const yearlyExpenseError = error
  const categoryExpenseError = error
  const yearlyCategoryExpenseError = error
  const expenseInfoError = error



  // 移除重复的useEffect，因为useExpenseReportsData已经会在参数变化时自动重新获取数据
  // 这样可以避免重复请求，确保在React严格模式下只有2次请求而不是4次

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Expense Reports</h1>

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

        <p className="text-muted-foreground mt-1">
          Comprehensive analysis of your subscription expenses
        </p>
      </div>

      {/* Expense Info Cards */}
      <div className="space-y-6">
        <div>
          {isLoadingExpenseInfo ? (
            <div>
              <p className="text-sm text-muted-foreground mb-4">Loading expense overview...</p>
              <ExpenseInfoCards
                monthlyData={[]}
                quarterlyData={[]}
                yearlyData={[]}
                currency={userCurrency}
                isLoading={true}
              />
            </div>
          ) : expenseInfoError ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center">
                  <p className="text-sm text-destructive mb-2">Failed to load expense overview</p>
                  <p className="text-xs text-muted-foreground">{expenseInfoError}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div>
              <ExpenseInfoCards
                monthlyData={permissions.hasPermission(Permission.VIEW_MONTHLY_EXPENSES) ? expenseInfoData.monthly : []}
                quarterlyData={permissions.hasPermission(Permission.VIEW_QUARTERLY_EXPENSES) ? expenseInfoData.quarterly : []}
                yearlyData={permissions.hasPermission(Permission.VIEW_YEARLY_EXPENSES) ? expenseInfoData.yearly : []}
                currency={userCurrency}
                hasMonthlyPermission={permissions.hasPermission(Permission.VIEW_MONTHLY_EXPENSES)}
                hasQuarterlyPermission={permissions.hasPermission(Permission.VIEW_QUARTERLY_EXPENSES)}
                hasYearlyPermission={permissions.hasPermission(Permission.VIEW_YEARLY_EXPENSES)}
              />
            </div>
          )}
        </div>
      </div>



      {/* Loading and Error States */}
      {isLoadingExpenses && (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading expense data...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {expenseError && (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <p className="text-sm text-destructive mb-2">Failed to load expense data</p>
              <p className="text-xs text-muted-foreground">{expenseError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {!isLoadingExpenses && !expenseError && (
        <div className="space-y-4">
          <Tabs defaultValue="monthly" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="monthly"
                disabled={!permissions.hasPermission(Permission.VIEW_MONTHLY_EXPENSES)}
              >
                Monthly
                {!permissions.hasPermission(Permission.VIEW_MONTHLY_EXPENSES) && (
                  <Lock className="h-3 w-3 ml-1" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="yearly"
                disabled={!permissions.hasPermission(Permission.VIEW_YEARLY_EXPENSES)}
              >
                Yearly
                {!permissions.hasPermission(Permission.VIEW_YEARLY_EXPENSES) && (
                  <Lock className="h-3 w-3 ml-1" />
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="monthly" className="space-y-4">
              {permissions.hasPermission(Permission.VIEW_MONTHLY_EXPENSES) ? (
                <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
                  <ExpenseTrendChart
                    data={adaptedMonthlyExpenses}
                    categoryData={adaptedMonthlyCategoryExpenses}
                    currency={userCurrency as string}
                    hasMonthlyPermission={permissions.hasPermission(Permission.VIEW_MONTHLY_EXPENSES)}
                    hasCategoryPermission={permissions.hasPermission(Permission.VIEW_CATEGORY_EXPENSES)}
                  />
                  {permissions.hasPermission(Permission.VIEW_CATEGORY_EXPENSES) ? (
                    isLoadingCategoryExpenses ? (
                      <Card>
                        <CardContent className="flex items-center justify-center h-[400px]">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                            <p className="text-sm text-muted-foreground">Loading category data...</p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : categoryExpenseError ? (
                      <Card>
                        <CardContent className="flex items-center justify-center h-[400px]">
                          <div className="text-center text-destructive">
                            <p className="font-medium">Failed to load category data</p>
                            <p className="text-sm text-muted-foreground mt-1">{categoryExpenseError}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <CategoryPieChart
                        data={categoryExpensesWithPercentage}
                        currency={userCurrency as string}
                      />
                    )
                  ) : (
                    <Card className="border-dashed border-amber-200">
                      <CardContent className="flex flex-col items-center justify-center h-[400px] text-center">
                        <Lock className="h-8 w-8 text-amber-500 mb-2" />
                        <h3 className="text-lg font-semibold mb-2 text-amber-700">
                          Category Analysis - Premium Feature
                        </h3>                        
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card className="border-dashed border-amber-200">
                  <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                    <Lock className="h-12 w-12 text-amber-500 mb-4" />
                    <h3 className="text-lg font-semibold mb-2 text-amber-700">
                      Monthly Analysis - Premium Feature
                    </h3>
                    <p className="text-muted-foreground mb-4 max-w-md">
                      Upgrade to Premium to unlock detailed monthly expense analysis and trends.
                    </p>
                    <Button className="bg-amber-500 hover:bg-amber-600">
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Premium
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="yearly" className="space-y-4">
              {permissions.hasPermission(Permission.VIEW_YEARLY_EXPENSES) ? (
                isLoadingYearlyExpenses ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading yearly data...</p>
                    </div>
                  </div>
                ) : yearlyExpenseError ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <p className="text-sm text-destructive mb-2">Failed to load yearly data</p>
                      <p className="text-xs text-muted-foreground">{yearlyExpenseError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
                    <YearlyTrendChart
                      data={adaptedYearlyExpenses}
                      categoryData={yearlyGroupedCategoryExpenses}
                      currency={userCurrency as string}
                    />
                    {permissions.hasPermission(Permission.VIEW_CATEGORY_EXPENSES) ? (
                      isLoadingYearlyCategoryExpenses ? (
                        <Card>
                          <CardContent className="flex items-center justify-center h-[400px]">
                            <div className="text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                              <p className="text-sm text-muted-foreground">Loading yearly category data...</p>
                            </div>
                          </CardContent>
                        </Card>
                      ) : yearlyCategoryExpenseError ? (
                        <Card>
                          <CardContent className="flex items-center justify-center h-[400px]">
                            <div className="text-center text-destructive">
                              <p className="font-medium">Failed to load yearly category data</p>
                              <p className="text-sm text-muted-foreground mt-1">{yearlyCategoryExpenseError}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <CategoryPieChart
                          data={categoryExpensesWithPercentage}
                          currency={userCurrency as string}
                        />
                      )
                    ) : (
                      <Card className="border-dashed border-amber-200">
                        <CardContent className="flex flex-col items-center justify-center h-[400px] text-center">
                          <Lock className="h-8 w-8 text-amber-500 mb-2" />
                          <h3 className="text-lg font-semibold mb-2 text-amber-700">
                            Category Analysis - Premium Feature
                          </h3>
                          <p className="text-muted-foreground mb-4 max-w-md">
                            Upgrade to Premium to unlock detailed category expense analysis.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )
              ) : (
                <Card className="border-dashed border-amber-200">
                  <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                    <Lock className="h-12 w-12 text-amber-500 mb-4" />
                    <h3 className="text-lg font-semibold mb-2 text-amber-700">
                      Yearly Analysis - Premium Feature
                    </h3>
                    <p className="text-muted-foreground mb-4 max-w-md">
                      Upgrade to Premium to unlock detailed yearly expense analysis and long-term trends.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Free Plan Upgrade Prompt */}
      {isFreePlan && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Crown className="h-8 w-8 text-amber-500 shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 mb-1">Unlock More Features</h3>
                <p className="text-sm text-amber-700">
                  Upgrade to Premium to access yearly analysis, category statistics, data export, and more advanced features.
                </p>
              </div>
              <Button className="bg-amber-500 hover:bg-amber-600 shrink-0">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
