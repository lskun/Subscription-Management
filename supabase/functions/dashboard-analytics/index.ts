// Edge Runtime types for Deno (Supabase Functions)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Deno runtime imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno runtime imports  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 提供 Deno 类型给本地 Lint/TS 检查（运行时由 Supabase Edge Runtime 注入）
declare const Deno: { env: { get: (key: string) => string | undefined } }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DashboardRequest {
  targetCurrency?: string
  upcomingDays?: number
  recentDays?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const requestData: DashboardRequest = req.method === 'POST'
      ? await req.json()
      : Object.fromEntries(new URL(req.url).searchParams.entries())

    const {
      targetCurrency = 'CNY',
      upcomingDays = 7,
      recentDays = 7
    } = requestData

    const { data, error } = await supabaseClient.rpc('get_dashboard_analytics', {
      target_currency: targetCurrency,
      upcoming_days: upcomingDays,
      recent_days: recentDays
    })

    if (error) {
      console.error('RPC call get_dashboard_analytics failed:', error)
      throw new Error(`Database RPC error: ${error.message}`)
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Dashboard analytics error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})