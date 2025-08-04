// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SubscriptionsRequest {
  targetCurrency?: string
  includeCategories?: boolean
  includePaymentMethods?: boolean
  filters?: {
    status?: 'all' | 'active' | 'cancelled'
    categories?: string[]
    billingCycles?: string[]
    searchTerm?: string
  }
  sorting?: {
    field?: 'nextBillingDate' | 'name' | 'amount'
    order?: 'asc' | 'desc'
  }
}

interface SubscriptionsResponse {
  subscriptions: Array<{
    id: string
    name: string
    plan: string
    amount: number
    currency: string
    convertedAmount: number
    billingCycle: string
    nextBillingDate: string
    lastBillingDate: string | null
    status: string
    categoryId: string
    paymentMethodId: string
    startDate: string
    renewalType: string
    notes: string
    website?: string
    category?: {
      id: string
      value: string
      label: string
    }
    paymentMethod?: {
      id: string
      value: string
      label: string
    }
  }>
  categories?: Array<{
    id: string
    value: string
    label: string
    is_default?: boolean
  }>
  paymentMethods?: Array<{
    id: string
    value: string
    label: string
    is_default?: boolean
  }>
  summary: {
    totalSubscriptions: number
    activeSubscriptions: number
    cancelledSubscriptions: number
    totalMonthlySpending: number
    totalYearlySpending: number
  }
  currency: string
  timestamp: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    //@ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    //@ts-ignore
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const requestData: SubscriptionsRequest = req.method === 'POST'
      ? await req.json()
      : {}

    const {
      targetCurrency = 'CNY',
      includeCategories = true,
      includePaymentMethods = true,
      filters = {},
      sorting = { field: 'nextBillingDate', order: 'asc' }
    } = requestData

    console.log('Subscriptions request:', { userId: user.id, targetCurrency, filters, sorting })

    // 获取汇率数据 - 只获取最新的汇率记录
    // 先获取最新日期
    const { data: latestDate, error: dateError } = await supabase
      .from('exchange_rates')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (dateError) {
      console.error('Error fetching latest exchange rate date:', dateError)
    }

    // 根据最新日期获取汇率数据
    const { data: exchangeRateData, error: exchangeRateError } = await supabase
      .from('exchange_rates')
      .select('from_currency, to_currency, rate')
      .eq('date', latestDate?.date)
      .order('from_currency', { ascending: true })

    if (exchangeRateError) {
      console.error('Error fetching exchange rates:', exchangeRateError)
    }

    // 构建汇率映射 - 支持双向转换
    const rateMap = new Map<string, number>()
    if (exchangeRateData) {
      exchangeRateData.forEach(rate => {
        const fromCurrency = rate.from_currency
        const toCurrency = rate.to_currency
        const rateValue = parseFloat(rate.rate)

        // 存储正向汇率 (from -> to)
        const forwardKey = `${fromCurrency}_${toCurrency}`
        rateMap.set(forwardKey, rateValue)

        // 存储反向汇率 (to -> from)
        const reverseKey = `${toCurrency}_${fromCurrency}`
        rateMap.set(reverseKey, 1 / rateValue)
      })
    }

    console.log('Available exchange rates:', Array.from(rateMap.keys()))

    // Function to convert currency
    const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string): number => {
      try {
        // 如果货币相同，直接返回
        if (fromCurrency === toCurrency) {
          return amount
        }

        // 构建汇率键
        const rateKey = `${fromCurrency}_${toCurrency}`

        // 检查是否有直接汇率
        if (rateMap.has(rateKey)) {
          const convertedAmount = amount * rateMap.get(rateKey)!
          console.log(`Converting ${amount} ${fromCurrency} to ${toCurrency}: ${convertedAmount} (rate: ${rateMap.get(rateKey)})`)
          return convertedAmount
        }

        // 如果没有直接汇率，尝试通过CNY作为中间货币转换
        const fromToCNY = `${fromCurrency}_CNY`
        const CNYToTarget = `CNY_${toCurrency}`

        if (rateMap.has(fromToCNY) && rateMap.has(CNYToTarget)) {
          const convertedAmount = amount * rateMap.get(fromToCNY)! * rateMap.get(CNYToTarget)!
          console.log(`Converting ${amount} ${fromCurrency} to ${toCurrency} via CNY: ${convertedAmount}`)
          return convertedAmount
        }

        console.warn(`Missing exchange rate for ${fromCurrency} to ${toCurrency}`)
        return amount // 返回原始金额
      } catch (error) {
        console.error(`货币转换出错 (${fromCurrency} 到 ${toCurrency}):`, error)
        return amount // 出错时返回原始金额
      }
    }

    // Build subscription query
    let subscriptionQuery = supabase
      .from('subscriptions')
      .select(`
        id,
        name,
        plan,
        amount,
        currency,
        billing_cycle,
        next_billing_date,
        last_billing_date,
        status,
        category_id,
        payment_method_id,
        start_date,
        renewal_type,
        notes,
        website,
        categories (
          id,
          value,
          label
        ),
        payment_methods (
          id,
          value,
          label
        )
      `)
      .eq('user_id', user.id)

    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'active') {
        subscriptionQuery = subscriptionQuery.neq('status', 'cancelled')
      } else if (filters.status === 'cancelled') {
        subscriptionQuery = subscriptionQuery.eq('status', 'cancelled')
      }
    }

    // Apply sorting
    if (sorting.field === 'nextBillingDate') {
      subscriptionQuery = subscriptionQuery.order('next_billing_date', { ascending: sorting.order === 'asc' })
    } else if (sorting.field === 'name') {
      subscriptionQuery = subscriptionQuery.order('name', { ascending: sorting.order === 'asc' })
    } else if (sorting.field === 'amount') {
      subscriptionQuery = subscriptionQuery.order('amount', { ascending: sorting.order === 'asc' })
    }

    const { data: subscriptions, error: subscriptionsError } = await subscriptionQuery

    if (subscriptionsError) {
      console.error('Error fetching subscriptions:', subscriptionsError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process subscriptions with currency conversion and filtering
    let processedSubscriptions = (subscriptions || []).map(sub => {
      const convertedAmount = convertCurrency(sub.amount, sub.currency, targetCurrency)

      return {
        id: sub.id,
        name: sub.name,
        plan: sub.plan,
        amount: sub.amount,
        currency: sub.currency,
        convertedAmount: Math.round(convertedAmount * 100) / 100,
        billingCycle: sub.billing_cycle,
        nextBillingDate: sub.next_billing_date,
        lastBillingDate: sub.last_billing_date,
        status: sub.status,
        categoryId: sub.category_id,
        paymentMethodId: sub.payment_method_id,
        startDate: sub.start_date,
        renewalType: sub.renewal_type,
        notes: sub.notes,
        website: sub.website,
        category: (sub as any).categories ? {
          id: (sub as any).categories.id,
          value: (sub as any).categories.value,
          label: (sub as any).categories.label
        } : undefined,
        paymentMethod: (sub as any).payment_methods ? {
          id: (sub as any).payment_methods.id,
          value: (sub as any).payment_methods.value,
          label: (sub as any).payment_methods.label
        } : undefined
      }
    })

    // Apply client-side filters
    if (filters.categories && filters.categories.length > 0) {
      processedSubscriptions = processedSubscriptions.filter(sub =>
        sub.category && filters.categories!.includes(sub.category.value)
      )
    }

    if (filters.billingCycles && filters.billingCycles.length > 0) {
      processedSubscriptions = processedSubscriptions.filter(sub =>
        filters.billingCycles!.includes(sub.billingCycle)
      )
    }

    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase()
      processedSubscriptions = processedSubscriptions.filter(sub =>
        sub.name.toLowerCase().includes(searchTerm) ||
        sub.plan.toLowerCase().includes(searchTerm)
      )
    }

    // Calculate summary statistics
    const totalSubscriptions = processedSubscriptions.length
    const activeSubscriptions = processedSubscriptions.filter(sub => sub.status !== 'cancelled').length
    const cancelledSubscriptions = processedSubscriptions.filter(sub => sub.status === 'cancelled').length

    let totalMonthlySpending = 0
    let totalYearlySpending = 0

    processedSubscriptions
      .filter(sub => sub.status !== 'cancelled')
      .forEach(sub => {
        const monthlyAmount = sub.billingCycle === 'monthly' ? sub.convertedAmount :
          sub.billingCycle === 'yearly' ? sub.convertedAmount / 12 :
            sub.billingCycle === 'quarterly' ? sub.convertedAmount / 3 :
              sub.convertedAmount

        const yearlyAmount = sub.billingCycle === 'monthly' ? sub.convertedAmount * 12 :
          sub.billingCycle === 'yearly' ? sub.convertedAmount :
            sub.billingCycle === 'quarterly' ? sub.convertedAmount * 4 :
              sub.convertedAmount * 12

        totalMonthlySpending += monthlyAmount
        totalYearlySpending += yearlyAmount
      })

    // Prepare response
    const response: SubscriptionsResponse = {
      subscriptions: processedSubscriptions,
      summary: {
        totalSubscriptions,
        activeSubscriptions,
        cancelledSubscriptions,
        totalMonthlySpending: Math.round(totalMonthlySpending * 100) / 100,
        totalYearlySpending: Math.round(totalYearlySpending * 100) / 100
      },
      currency: targetCurrency,
      timestamp: new Date().toISOString()
    }

    // Fetch categories if requested
    if (includeCategories) {
      const { data: categories } = await supabase
        .from('categories')
        .select('id, value, label, is_default')
        .eq('user_id', user.id)
        .order('label')

      response.categories = categories || []
    }

    // Fetch payment methods if requested
    if (includePaymentMethods) {
      const { data: paymentMethods } = await supabase
        .from('payment_methods')
        .select('id, value, label, is_default')
        .eq('user_id', user.id)
        .order('label')

      response.paymentMethods = paymentMethods || []
    }

    console.log('Subscriptions response prepared:', {
      subscriptionsCount: response.subscriptions.length,
      categoriesCount: response.categories?.length || 0,
      paymentMethodsCount: response.paymentMethods?.length || 0,
      summary: response.summary
    })

    return new Response(
      JSON.stringify({ success: true, data: response }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Subscriptions management error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})