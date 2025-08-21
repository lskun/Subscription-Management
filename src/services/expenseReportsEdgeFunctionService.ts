import { supabaseGateway } from '@/utils/supabase-gateway'

export interface MonthlyExpense {
  month: string
  year: number
  total: number
  currency: string
  activeSubscriptionCount?: number
}

export interface QuarterlyExpense {
  quarter: number
  year: number
  total: number
  currency: string
  activeSubscriptionCount?: number
}

export interface YearlyExpense {
  year: number
  total: number
  currency: string
  activeSubscriptionCount?: number
}

export interface CategoryExpense {
  category: string
  label: string
  total: number
  currency: string
  subscriptionCount: number
}

export interface MonthlyCategoryExpense {
  month: string
  monthKey: string
  year: number
  categories: Record<string, number>
  total: number
}

export interface ExpenseInfoData {
  period: string
  amount: number
  change: number
  currency: string
  paymentCount?: number
}

export interface ExpenseReportsRequest {
  targetCurrency?: string
  monthlyStartDate?: string
  monthlyEndDate?: string
  quarterlyStartDate?: string
  quarterlyEndDate?: string
  yearlyStartDate?: string
  yearlyEndDate?: string
  includeMonthlyExpenses?: boolean
  includeQuarterlyExpenses?: boolean
  includeYearlyExpenses?: boolean
  includeCategoryExpenses?: boolean
  includeExpenseInfo?: boolean
}

export interface ExpenseReportsResponse {
  monthlyExpenses?: MonthlyExpense[]
  quarterlyExpenses?: QuarterlyExpense[]
  yearlyExpenses?: YearlyExpense[]
  categoryExpenses?: CategoryExpense[]
  yearlyCategoryExpenses?: CategoryExpense[]
  monthlyCategoryExpenses?: MonthlyCategoryExpense[]
  expenseInfo?: {
    monthly: ExpenseInfoData[]
    quarterly: ExpenseInfoData[]
    yearly: ExpenseInfoData[]
  }
  currency: string
  timestamp: string
}

export interface ExpenseReportsApiResponse {
  success: boolean
  data?: ExpenseReportsResponse
  error?: string
}

class ExpenseReportsEdgeFunctionService {
  private readonly functionName = 'expense-reports'

  /**
   * 调用 expense-reports edge function 获取费用报告数据
   */
  async getExpenseReports(request: ExpenseReportsRequest): Promise<ExpenseReportsResponse> {
    try {
      console.log('Calling expense-reports edge function')

      const { data, error } = await supabaseGateway.invokeFunction<ExpenseReportsApiResponse>(
        this.functionName,
        { body: request }
      )

      if (error) {
        console.error('Edge function error:', error)
        throw new Error(`Edge function error: ${error.message}`)
      }

      if (!data) {
        console.error('No data returned from edge function')
        throw new Error('No data returned from edge function')
      }

      console.log('Edge function data:', data)

      if (!data.success) {
        console.error('Edge function returned error:', data.error)
        throw new Error(data.error || 'Edge function returned error')
      }

      if (!data.data) {
        console.error('No data in successful response')
        throw new Error('No data in successful response')
      }

      console.log('Successfully fetched expense reports data:', data.data)
      return data.data

    } catch (error) {
      console.error('Failed to fetch expense reports:', error)
      throw error instanceof Error ? error : new Error('Unknown error occurred')
    }
  }

  /**
   * 获取月度费用数据
   */
  async getMonthlyExpenses(
    startDate: Date,
    endDate: Date,
    currency: string = 'CNY'
  ): Promise<MonthlyExpense[]> {
    const response = await this.getExpenseReports({
      targetCurrency: currency,
      monthlyStartDate: startDate.toISOString(),
      monthlyEndDate: endDate.toISOString(),
      includeMonthlyExpenses: true,
      includeYearlyExpenses: false,
      includeCategoryExpenses: false,
      includeExpenseInfo: false
    })

    return response.monthlyExpenses || []
  }

  /**
   * 获取年度费用数据
   */
  async getYearlyExpenses(
    startDate: Date,
    endDate: Date,
    currency: string = 'CNY'
  ): Promise<YearlyExpense[]> {
    const response = await this.getExpenseReports({
      targetCurrency: currency,
      yearlyStartDate: startDate.toISOString(),
      yearlyEndDate: endDate.toISOString(),
      includeMonthlyExpenses: false,
      includeYearlyExpenses: true,
      includeCategoryExpenses: false,
      includeExpenseInfo: false
    })

    return response.yearlyExpenses || []
  }

  /**
   * 获取分类费用数据
   */
  async getCategoryExpenses(
    startDate: Date,
    endDate: Date,
    currency: string = 'CNY'
  ): Promise<CategoryExpense[]> {
    const response = await this.getExpenseReports({
      targetCurrency: currency,
      monthlyStartDate: startDate.toISOString(),
      monthlyEndDate: endDate.toISOString(),
      includeMonthlyExpenses: false,
      includeYearlyExpenses: false,
      includeCategoryExpenses: true,
      includeExpenseInfo: false
    })

    return response.categoryExpenses || []
  }

  /**
   * 获取费用信息数据（用于ExpenseInfoCards）
   */
  async getExpenseInfo(currency: string = 'CNY'): Promise<{
    monthly: ExpenseInfoData[]
    quarterly: ExpenseInfoData[]
    yearly: ExpenseInfoData[]
  }> {
    const response = await this.getExpenseReports({
      targetCurrency: currency,
      includeMonthlyExpenses: false,
      includeYearlyExpenses: false,
      includeCategoryExpenses: false,
      includeExpenseInfo: true
    })

    return response.expenseInfo || {
      monthly: [],
      quarterly: [],
      yearly: []
    }
  }

  /**
   * 获取完整的费用报告数据
   */
  async getFullExpenseReports(
    monthlyStartDate: Date,
    monthlyEndDate: Date,
    yearlyStartDate: Date,
    yearlyEndDate: Date,
    currency: string = 'CNY'
  ): Promise<ExpenseReportsResponse> {
    return this.getExpenseReports({
      targetCurrency: currency,
      monthlyStartDate: monthlyStartDate.toISOString(),
      monthlyEndDate: monthlyEndDate.toISOString(),
      yearlyStartDate: yearlyStartDate.toISOString(),
      yearlyEndDate: yearlyEndDate.toISOString(),
      includeMonthlyExpenses: true,
      includeYearlyExpenses: true,
      includeCategoryExpenses: true,
      includeExpenseInfo: true
    })
  }
}

export const expenseReportsEdgeFunctionService = new ExpenseReportsEdgeFunctionService()