// @ts-ignore - Deno runtime imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno runtime imports  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DashboardRequest {
    targetCurrency?: string
    includeUpcomingRenewals?: boolean
    includeRecentlyPaid?: boolean
    includeCategoryBreakdown?: boolean
    upcomingDays?: number
    recentDays?: number
}

interface DashboardResponse {
    monthlySpending: number
    yearlySpending: number
    activeSubscriptions: number
    upcomingRenewals?: any[]
    recentlyPaid?: any[]
    categoryBreakdown?: any[]
    currency: string
    timestamp: string
}

/**
 * 货币转换函数
 */
function convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    exchangeRates: Record<string, number>
): number {
    // 如果货币相同，直接返回
    if (fromCurrency === toCurrency) {
        return amount
    }

    // 构建汇率键
    const rateKey = `${fromCurrency}_${toCurrency}`

    // 检查是否有直接汇率
    if (exchangeRates[rateKey]) {
        const convertedAmount = amount * exchangeRates[rateKey]
        console.log(`Converting ${amount} ${fromCurrency} to ${toCurrency}: ${convertedAmount} (rate: ${exchangeRates[rateKey]})`)
        return convertedAmount
    }

    // 如果没有直接汇率，尝试通过CNY作为中间货币转换
    const fromToCNY = `${fromCurrency}_CNY`
    const CNYToTarget = `CNY_${toCurrency}`

    if (exchangeRates[fromToCNY] && exchangeRates[CNYToTarget]) {
        const convertedAmount = amount * exchangeRates[fromToCNY] * exchangeRates[CNYToTarget]
        console.log(`Converting ${amount} ${fromCurrency} to ${toCurrency} via CNY: ${convertedAmount}`)
        return convertedAmount
    }

    console.warn(`Missing exchange rate for ${fromCurrency} to ${toCurrency}`)
    return amount // 返回原始金额
}

/**
 * 计算订阅的月度费用
 */
function calculateMonthlyAmount(amount: number, billingCycle: string): number {
    switch (billingCycle) {
        case 'monthly':
            return amount
        case 'yearly':
            return amount / 12
        case 'quarterly':
            return amount / 3
        default:
            return amount
    }
}

/**
 * 计算订阅的年度费用
 */
function calculateYearlyAmount(amount: number, billingCycle: string): number {
    switch (billingCycle) {
        case 'monthly':
            return amount * 12
        case 'quarterly':
            return amount * 4
        case 'yearly':
            return amount
        default:
            return amount
    }
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 创建 Supabase 客户端
        // @ts-ignore - Deno runtime environment
        const supabaseClient = createClient(
            // @ts-ignore - Deno runtime environment
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore - Deno runtime environment
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        )

        // 验证用户身份
        const {
            data: { user },
            error: userError,
        } = await supabaseClient.auth.getUser()

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // 解析请求参数
        const requestData: DashboardRequest = req.method === 'POST'
            ? await req.json()
            : Object.fromEntries(new URL(req.url).searchParams.entries())

        const {
            targetCurrency = 'CNY',
            includeUpcomingRenewals = true,
            includeRecentlyPaid = true,
            includeCategoryBreakdown = true,
            upcomingDays = 7,
            recentDays = 7
        } = requestData

        console.log(`Dashboard analytics request for user ${user.id}, currency: ${targetCurrency}`)

        // 获取汇率数据 - 只获取最新的汇率记录
        // 先获取最新日期
        const { data: latestDate, error: dateError } = await supabaseClient
            .from('exchange_rates')
            .select('date')
            .order('date', { ascending: false })
            .limit(1)
            .single()

        if (dateError) {
            console.error('Error fetching latest exchange rate date:', dateError)
        }

        // 根据最新日期获取汇率数据
        const { data: exchangeRateData, error: exchangeRateError } = await supabaseClient
            .from('exchange_rates')
            .select('from_currency, to_currency, rate')
            .eq('date', latestDate?.date)
            .order('from_currency', { ascending: true })

        if (exchangeRateError) {
            console.error('Error fetching exchange rates:', exchangeRateError)
        }

        // 构建汇率映射 - 支持双向转换
        const exchangeRates: Record<string, number> = {}
        if (exchangeRateData) {
            exchangeRateData.forEach(rate => {
                const fromCurrency = rate.from_currency
                const toCurrency = rate.to_currency
                const rateValue = parseFloat(rate.rate)

                // 存储正向汇率 (from -> to)
                const forwardKey = `${fromCurrency}_${toCurrency}`
                exchangeRates[forwardKey] = rateValue

                // 存储反向汇率 (to -> from)
                const reverseKey = `${toCurrency}_${fromCurrency}`
                exchangeRates[reverseKey] = 1 / rateValue
            })
        }

        console.log('Available exchange rates:', Object.keys(exchangeRates))

        // 获取用户的活跃订阅
        const { data: subscriptions, error: subscriptionsError } = await supabaseClient
            .from('subscriptions')
            .select(`
        id,
        name,
        amount,
        currency,
        billing_cycle,
        status,
        next_billing_date,
        last_billing_date,
        category_id,
        categories (
          value,
          label
        )
      `)
            .eq('user_id', user.id)
            .eq('status', 'active')

        if (subscriptionsError) {
            throw new Error(`Failed to fetch subscriptions: ${subscriptionsError.message}`)
        }

        const activeSubscriptions = subscriptions || []
        console.log(`Found ${activeSubscriptions.length} active subscriptions`)

        // 计算月度和年度支出
        let monthlySpending = 0
        let yearlySpending = 0

        activeSubscriptions.forEach(subscription => {
            const amount = typeof subscription.amount === 'number'
                ? subscription.amount
                : parseFloat(subscription.amount) || 0

            const fromCurrency = subscription.currency || 'CNY'

            // 计算月度费用
            const monthlyAmount = calculateMonthlyAmount(amount, subscription.billing_cycle)
            const convertedMonthly = convertCurrency(monthlyAmount, fromCurrency, targetCurrency, exchangeRates)
            monthlySpending += convertedMonthly

            // 计算年度费用
            const yearlyAmount = calculateYearlyAmount(amount, subscription.billing_cycle)
            const convertedYearly = convertCurrency(yearlyAmount, fromCurrency, targetCurrency, exchangeRates)
            yearlySpending += convertedYearly
        })

        // 构建响应数据
        const response: DashboardResponse = {
            monthlySpending: Math.round(monthlySpending * 100) / 100,
            yearlySpending: Math.round(yearlySpending * 100) / 100,
            activeSubscriptions: activeSubscriptions.length,
            currency: targetCurrency,
            timestamp: new Date().toISOString()
        }

        // 获取即将续费的订阅
        if (includeUpcomingRenewals) {
            const today = new Date()
            const futureDate = new Date()
            futureDate.setDate(today.getDate() + upcomingDays)

            const upcomingRenewals = activeSubscriptions
                .filter(sub => {
                    if (!sub.next_billing_date) return false
                    const nextBillingDate = new Date(sub.next_billing_date)
                    return nextBillingDate >= today && nextBillingDate <= futureDate
                })
                .map(sub => ({
                    id: sub.id,
                    name: sub.name,
                    amount: sub.amount,
                    currency: sub.currency,
                    next_billing_date: sub.next_billing_date,
                    billing_cycle: sub.billing_cycle,
                    convertedAmount: Math.round(
                        convertCurrency(sub.amount, sub.currency || 'CNY', targetCurrency, exchangeRates) * 100
                    ) / 100
                }))
                .sort((a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime())

            response.upcomingRenewals = upcomingRenewals
            console.log(`Found ${upcomingRenewals.length} upcoming renewals`)
        }

        // 获取最近支付的订阅
        if (includeRecentlyPaid) {
            const today = new Date()
            const pastDate = new Date()
            pastDate.setDate(today.getDate() - recentDays)

            const recentlyPaid = activeSubscriptions
                .filter(sub => {
                    if (!sub.last_billing_date) return false
                    const lastBillingDate = new Date(sub.last_billing_date)
                    return lastBillingDate >= pastDate && lastBillingDate <= today
                })
                .map(sub => ({
                    id: sub.id,
                    name: sub.name,
                    amount: sub.amount,
                    currency: sub.currency,
                    last_billing_date: sub.last_billing_date,
                    billing_cycle: sub.billing_cycle,
                    convertedAmount: Math.round(
                        convertCurrency(sub.amount, sub.currency || 'CNY', targetCurrency, exchangeRates) * 100
                    ) / 100
                }))
                .sort((a, b) => new Date(b.last_billing_date).getTime() - new Date(a.last_billing_date).getTime())

            response.recentlyPaid = recentlyPaid
            console.log(`Found ${recentlyPaid.length} recently paid subscriptions`)
        }

        // 获取分类支出统计
        if (includeCategoryBreakdown) {
            const categoryMap = new Map<string, {
                label: string
                amount: number
                subscriptions: Set<string>
            }>()
            let totalAmount = 0

            activeSubscriptions.forEach(subscription => {
                const amount = typeof subscription.amount === 'number'
                    ? subscription.amount
                    : parseFloat(subscription.amount) || 0

                const yearlyAmount = calculateYearlyAmount(amount, subscription.billing_cycle)
                const convertedAmount = convertCurrency(
                    yearlyAmount,
                    subscription.currency || 'CNY',
                    targetCurrency,
                    exchangeRates
                )

                const categoryValue = (subscription as any).categories?.value || 'other'
                const categoryLabel = (subscription as any).categories?.label || '其他'

                if (!categoryMap.has(categoryValue)) {
                    categoryMap.set(categoryValue, {
                        label: categoryLabel,
                        amount: 0,
                        subscriptions: new Set()
                    })
                }

                const categoryData = categoryMap.get(categoryValue)!
                categoryData.amount += convertedAmount
                categoryData.subscriptions.add(subscription.id)
                totalAmount += convertedAmount
            })

            const categoryBreakdown = Array.from(categoryMap.entries())
                .map(([category, data]) => ({
                    category,
                    label: data.label,
                    amount: Math.round(data.amount * 100) / 100,
                    percentage: totalAmount > 0 ? Math.round((data.amount / totalAmount) * 100 * 100) / 100 : 0,
                    subscriptionCount: data.subscriptions.size
                }))
                .sort((a, b) => b.amount - a.amount)

            response.categoryBreakdown = categoryBreakdown
            console.log(`Generated category breakdown with ${categoryBreakdown.length} categories`)
        }

        console.log(`Dashboard analytics completed for user ${user.id}`)

        return new Response(
            JSON.stringify({
                success: true,
                data: response
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )

    } catch (error) {
        console.error('Dashboard analytics error:', error)

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Internal server error'
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})