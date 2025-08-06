// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers remain the same
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Request interface remains useful for type safety
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-ignore
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

    // Set default values for parameters
    const {
      targetCurrency = 'CNY',
      includeCategories = true,
      includePaymentMethods = true,
      filters = {},
      sorting = { field: 'nextBillingDate', order: 'asc' }
    } = requestData

    console.log('Calling get_managed_subscriptions RPC for user:', { userId: user.id, targetCurrency, filters, sorting })

    // *** CORE OPTIMIZATION: Single RPC call to the database function ***
    const { data, error } = await supabase.rpc('get_managed_subscriptions', {
      p_user_id: user.id,
      p_target_currency: targetCurrency,
      p_filters: filters,
      p_sorting: sorting,
      p_include_categories: includeCategories,
      p_include_payment_methods: includePaymentMethods
    })

    if (error) {
      console.error('RPC call get_managed_subscriptions failed:', error)
      throw new Error(`Database RPC error: ${error.message}`)
    }

    console.log('RPC call successful. Returning data.')

    // The data returned from the RPC is already in the desired final format.
    return new Response(
      JSON.stringify({ success: true, data }),
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
