// @ts-ignore - Deno runtime environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno runtime environment
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExchangeRateData {
  from_currency: string
  to_currency: string
  rate: number
  date: string
  source: string
}

interface TianApiResponse {
  code: number
  msg: string
  result?: {
    from: string
    to: string
    fromname: string
    toname: string
    rate: string
    update: string
  }
}

// 汇率更新核心逻辑
async function updateExchangeRates(
  supabase: any,
  updateType: string = 'manual',
  currencies: string[] = [],
  tianApiKey?: string
) {
  console.log(`Starting exchange rate update: ${updateType}`)

  // Start logging the update
  const { data: logData, error: logError } = await supabase
    .from('exchange_rate_update_logs')
    .insert({
      update_type: updateType,
      status: 'success', // Will be updated later
      source: 'edge_function',
      started_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (logError) {
    console.error('Failed to create update log:', logError)
    throw new Error('Failed to create update log')
  }

  const logId = logData.id
  let updatedRates = 0
  let errorMessage: string | null = null

  try {
    if (!tianApiKey) {
      throw new Error('TIANAPI_KEY not configured')
    }

    // Default currencies to update
    const baseCurrency = 'CNY'
    const targetCurrencies = currencies.length > 0 ? currencies : [
      'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'
    ]

    const rates: ExchangeRateData[] = []
    const today = new Date().toISOString().split('T')[0]

    // Fetch rates from TianAPI with retry logic
    for (const currency of targetCurrencies) {
      if (currency === baseCurrency) continue

      let retryCount = 0
      const maxRetries = 3
      let success = false

      while (retryCount < maxRetries && !success) {
        try {
          const response = await fetch(
            `https://apis.tianapi.com/fxrate/index?key=${tianApiKey}&fromcoin=${baseCurrency}&tocoin=${currency}&money=1`,
            {
              method: 'GET'
            }
          )

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`)
          }

          const data: TianApiResponse = await response.json()

          if (data.code !== 200 || !data.result) {
            throw new Error(`API error: ${data.msg}`)
          }

          const rate = parseFloat(data.result.money)
          if (isNaN(rate) || rate <= 0) {
            throw new Error(`Invalid rate: ${data.result.money}`)
          }

          rates.push({
            from_currency: baseCurrency,
            to_currency: currency,
            rate: rate,
            date: today,
            source: 'api'
          })

          success = true
          console.log(`Successfully fetched rate for ${currency}: ${rate}`)

          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error) {
          retryCount++
          console.error(`Error fetching rate for ${currency} (attempt ${retryCount}):`, error)

          if (retryCount < maxRetries) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
          }
        }
      }

      if (!success) {
        console.error(`Failed to fetch rate for ${currency} after ${maxRetries} attempts`)
      }
    }

    // Add base currency to itself
    rates.push({
      from_currency: baseCurrency,
      to_currency: baseCurrency,
      rate: 1.0,
      date: today,
      source: 'system'
    })

    if (rates.length === 0) {
      throw new Error('No exchange rates were successfully fetched')
    }

    // Update rates in database
    const { error: upsertError } = await supabase
      .from('exchange_rates')
      .upsert(rates.map(rate => ({
        ...rate,
        updated_at: new Date().toISOString()
      })), {
        onConflict: 'from_currency,to_currency,date'
      })

    if (upsertError) {
      throw new Error(`Failed to update rates: ${upsertError.message}`)
    }

    updatedRates = rates.length
    console.log(`Successfully updated ${updatedRates} exchange rates`)

    // Update log with success
    await supabase
      .from('exchange_rate_update_logs')
      .update({
        status: 'success',
        rates_updated: updatedRates,
        completed_at: new Date().toISOString()
      })
      .eq('id', logId)

    return {
      success: true,
      message: `Updated ${updatedRates} exchange rates`,
      rates_updated: updatedRates,
      log_id: logId
    }

  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Exchange rate update failed:', errorMessage)

    // Update log with failure
    await supabase
      .from('exchange_rate_update_logs')
      .update({
        status: 'failed',
        rates_updated: updatedRates,
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', logId)

    throw new Error(errorMessage)
  }
}

// 模拟调度器状态（Edge Functions是无状态的，实际调度由外部系统处理）
function getSchedulerStatus() {
  const now = new Date()
  const next = new Date(now)

  // 计算下一个6小时的整点
  const currentHour = now.getUTCHours()
  const nextHour = Math.ceil((currentHour + 1) / 6) * 6

  if (nextHour >= 24) {
    next.setUTCDate(next.getUTCDate() + 1)
    next.setUTCHours(0, 0, 0, 0)
  } else {
    next.setUTCHours(nextHour, 0, 0, 0)
  }

  return {
    isRunning: true, // Edge Functions总是"运行中"
    nextUpdate: next.toISOString(),
    description: 'Edge Function ready for scheduled calls'
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    // @ts-ignore - Deno runtime environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-ignore - Deno runtime environment
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // @ts-ignore - Deno runtime environment
    const tianApiKey = Deno.env.get('TIANAPI_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Edge Functions是无状态的，不需要初始化调度器

    // 解析请求
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'update'

    // 处理不同的操作
    switch (action) {
      case 'update': {
        // 手动更新汇率
        const body = req.method === 'POST' ? await req.json() : {}
        const { updateType = 'manual', currencies = [] } = body

        const result = await updateExchangeRates(supabase, updateType, currencies, tianApiKey)

        return new Response(
          JSON.stringify(result),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'status': {
        // 获取调度器状态
        const schedulerStatus = getSchedulerStatus()

        // 获取最新的更新统计
        const { data: stats, error: statsError } = await supabase.rpc('get_exchange_rate_stats')

        if (statsError) {
          console.error('Failed to get stats:', statsError)
        }

        return new Response(
          JSON.stringify({
            scheduler: schedulerStatus,
            stats: stats || {},
            timestamp: new Date().toISOString()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'logs': {
        // 获取更新日志
        const limit = parseInt(url.searchParams.get('limit') || '20')

        const { data: logs, error } = await supabase
          .from('exchange_rate_update_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit)

        if (error) {
          throw new Error(`Failed to fetch logs: ${error.message}`)
        }

        return new Response(
          JSON.stringify({
            success: true,
            logs: logs || [],
            count: logs?.length || 0
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'cleanup': {
        // 清理旧数据
        const daysToKeep = parseInt(url.searchParams.get('days') || '90')
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

        // 清理旧的汇率历史记录
        const { error: historyError } = await supabase
          .from('exchange_rate_history')
          .delete()
          .lt('created_at', cutoffDate.toISOString())

        // 清理旧的更新日志
        const { error: logsError } = await supabase
          .from('exchange_rate_update_logs')
          .delete()
          .lt('created_at', cutoffDate.toISOString())

        if (historyError || logsError) {
          throw new Error(`Cleanup failed: ${historyError?.message || logsError?.message}`)
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Cleaned up data older than ${daysToKeep} days`,
            cutoff_date: cutoffDate.toISOString()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      default: {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unknown action: ${action}`,
            available_actions: ['update', 'status', 'logs', 'cleanup']
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }
    }

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})