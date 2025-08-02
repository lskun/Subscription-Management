import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  expenseReportsEdgeFunctionService,
  ExpenseReportsResponse,
  MonthlyExpense,
  YearlyExpense,
  CategoryExpense,
  ExpenseInfoData
} from '@/services/expenseReportsEdgeFunctionService'

export interface UseExpenseReportsDataOptions {
  monthlyStartDate?: Date
  monthlyEndDate?: Date
  yearlyStartDate?: Date
  yearlyEndDate?: Date
  currency?: string
  includeMonthlyExpenses?: boolean
  includeYearlyExpenses?: boolean
  includeCategoryExpenses?: boolean
  includeExpenseInfo?: boolean
  autoFetch?: boolean
}

export interface UseExpenseReportsDataReturn {
  // 数据
  monthlyExpenses: MonthlyExpense[]
  yearlyExpenses: YearlyExpense[]
  categoryExpenses: CategoryExpense[]
  yearlyCategoryExpenses: CategoryExpense[]
  expenseInfo: {
    monthly: ExpenseInfoData[]
    quarterly: ExpenseInfoData[]
    yearly: ExpenseInfoData[]
  }
  
  // 状态
  isLoading: boolean
  error: string | null
  
  // 方法
  fetchData: () => Promise<void>
  refetch: () => Promise<void>
  
  // 最后更新时间
  lastUpdated: Date | null
}

export function useExpenseReportsData(options: UseExpenseReportsDataOptions = {}): UseExpenseReportsDataReturn {
  const {
    monthlyStartDate,
    monthlyEndDate,
    yearlyStartDate,
    yearlyEndDate,
    currency = 'CNY',
    includeMonthlyExpenses = true,
    includeYearlyExpenses = true,
    includeCategoryExpenses = true,
    includeExpenseInfo = true,
    autoFetch = true
  } = options

  // 状态
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([])
  const [yearlyExpenses, setYearlyExpenses] = useState<YearlyExpense[]>([])
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpense[]>([])
  const [yearlyCategoryExpenses, setYearlyCategoryExpenses] = useState<CategoryExpense[]>([])
  const [expenseInfo, setExpenseInfo] = useState<{
    monthly: ExpenseInfoData[]
    quarterly: ExpenseInfoData[]
    yearly: ExpenseInfoData[]
  }>({
    monthly: [],
    quarterly: [],
    yearly: []
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  // 请求去重机制
  const [currentRequest, setCurrentRequest] = useState<Promise<void> | null>(null)

  // 获取数据的函数 - 添加请求去重机制
  const fetchData = useCallback(async () => {
    if (!monthlyStartDate || !monthlyEndDate || !yearlyStartDate || !yearlyEndDate) {
      console.warn('Missing required date parameters for expense reports')
      return
    }

    // 如果已有正在进行的请求，等待它完成
    if (currentRequest) {
      console.log('useExpenseReportsData - Request already in progress, waiting for completion...')
      return currentRequest
    }

    const requestPromise = (async () => {
      setIsLoading(true)
      setError(null)

      try {
        console.log('useExpenseReportsData - Fetching expense reports data...')
        
        const response = await expenseReportsEdgeFunctionService.getFullExpenseReports(
          monthlyStartDate,
          monthlyEndDate,
          yearlyStartDate,
          yearlyEndDate,
          currency
        )

        // 更新状态
        if (includeMonthlyExpenses && response.monthlyExpenses) {
          setMonthlyExpenses(response.monthlyExpenses)
        }

        if (includeYearlyExpenses && response.yearlyExpenses) {
          setYearlyExpenses(response.yearlyExpenses)
        }

        if (includeCategoryExpenses) {
          if (response.categoryExpenses) {
            setCategoryExpenses(response.categoryExpenses)
          }
          if (response.yearlyCategoryExpenses) {
            setYearlyCategoryExpenses(response.yearlyCategoryExpenses)
          }
        }

        if (includeExpenseInfo && response.expenseInfo) {
          setExpenseInfo(response.expenseInfo)
        }

        setLastUpdated(new Date())
        console.log('useExpenseReportsData - Successfully fetched expense reports data')

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch expense reports data'
        console.error('Error fetching expense reports data:', errorMessage)
        setError(errorMessage)
      } finally {
        setIsLoading(false)
        setCurrentRequest(null) // 清除当前请求
      }
    })()

    setCurrentRequest(requestPromise)
    return requestPromise
  }, [
    monthlyStartDate,
    monthlyEndDate,
    yearlyStartDate,
    yearlyEndDate,
    currency,
    includeMonthlyExpenses,
    includeYearlyExpenses,
    includeCategoryExpenses,
    includeExpenseInfo
    // 注意：不要将 currentRequest 包含在依赖数组中，这会导致无限循环
  ])

  // 重新获取数据
  const refetch = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  // 使用 useRef 来跟踪是否已经发起过请求，避免在严格模式下重复请求
  const didInitialFetchRef = useRef(false);
  
  // 自动获取数据
  useEffect(() => {
    if (autoFetch && !didInitialFetchRef.current) {
      didInitialFetchRef.current = true;
      fetchData();
    }
  }, [fetchData, autoFetch])

  return {
    // 数据
    monthlyExpenses,
    yearlyExpenses,
    categoryExpenses,
    yearlyCategoryExpenses,
    expenseInfo,
    
    // 状态
    isLoading,
    error,
    
    // 方法
    fetchData,
    refetch,
    
    // 最后更新时间
    lastUpdated
  }
}

// 简化版本的 hooks，用于单独获取特定数据
export function useMonthlyExpenses(startDate: Date, endDate: Date, currency: string = 'CNY') {
  const [data, setData] = useState<MonthlyExpense[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await expenseReportsEdgeFunctionService.getMonthlyExpenses(startDate, endDate, currency)
      setData(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch monthly expenses'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate, currency])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}

export function useYearlyExpenses(startDate: Date, endDate: Date, currency: string = 'CNY') {
  const [data, setData] = useState<YearlyExpense[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await expenseReportsEdgeFunctionService.getYearlyExpenses(startDate, endDate, currency)
      setData(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch yearly expenses'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate, currency])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}

export function useCategoryExpenses(startDate: Date, endDate: Date, currency: string = 'CNY') {
  const [data, setData] = useState<CategoryExpense[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await expenseReportsEdgeFunctionService.getCategoryExpenses(startDate, endDate, currency)
      setData(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch category expenses'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate, currency])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}

export function useExpenseInfo(currency: string = 'CNY') {
  const [data, setData] = useState<{
    monthly: ExpenseInfoData[]
    quarterly: ExpenseInfoData[]
    yearly: ExpenseInfoData[]
  }>({
    monthly: [],
    quarterly: [],
    yearly: []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await expenseReportsEdgeFunctionService.getExpenseInfo(currency)
      setData(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch expense info'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [currency])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}