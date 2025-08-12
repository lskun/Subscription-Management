// @ts-ignore - Deno runtime environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno runtime environment
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const limit = Math.max(1, Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1000))

    // @ts-ignore - Deno runtime environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-ignore
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // 查询到期的自动续费订阅（按天判断）
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    const { data: dueSubs, error: queryError } = await supabase
      .from('subscriptions')
      .select('id,user_id,renewal_type,status,next_billing_date')
      .eq('renewal_type', 'auto')
      .eq('status', 'active')
      .lte('next_billing_date', todayStr)
      .order('next_billing_date', { ascending: true })
      .limit(limit)

    if (queryError) {
      throw new Error(`Failed to query due subscriptions: ${queryError.message}`)
    }

    let processed = 0
    let errors = 0
    const results: Array<{ id: string, ok: boolean, error?: string }> = []

    for (const sub of dueSubs || []) {
      try {
        const { data, error } = await supabase
          .rpc('process_subscription_renewal', { p_subscription_id: sub.id, p_user_id: sub.user_id })

        if (error) {
          errors += 1
          results.push({ id: sub.id, ok: false, error: error.message })
        } else {
          processed += 1
          results.push({ id: sub.id, ok: true })
        }
      } catch (e: any) {
        errors += 1
        results.push({ id: sub.id, ok: false, error: e?.message || 'unknown error' })
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, errors, count: (dueSubs || []).length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})


