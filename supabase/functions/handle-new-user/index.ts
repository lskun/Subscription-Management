// Edge Function for handling new user registration
// This function is called via Database Webhook when a new user is created
// @ts-ignore - Deno runtime environment
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface WebhookPayload {
  type: string
  table: string
  record: {
    id: string
    email?: string
    created_at: string
    user_metadata?: Record<string, any>
    app_metadata?: Record<string, any>
  }
  schema: string
  old_record: null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
// @ts-ignore - Deno runtime environment
Deno.serve(async (req: Request) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 只处理POST请求
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    // 获取环境变量
    // @ts-ignore - Deno runtime environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    // @ts-ignore - Deno runtime environment
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing required environment variables')
    }

    // 创建Supabase客户端
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 获取Webhook请求数据
    const payload: WebhookPayload = await req.json()
    
    // 验证请求数据
    if (!payload.record || !payload.record.id) {
      throw new Error('Invalid webhook payload: missing user record')
    }

    const userId = payload.record.id
    const userEmail = payload.record.email || ''

    console.log('处理新用户注册:', { userId, email: userEmail })

    // 1. 创建用户配置
    console.log('创建用户配置...')
    const { error: profileError } = await supabaseClient
      .from('user_profiles')
      .insert({
        id: userId,
        display_name: userEmail.split('@')[0] || '新用户',
        timezone: 'Asia/Shanghai',
        language: 'zh-CN'
      })

    if (profileError) {
      console.error('创建用户配置失败:', profileError)
      throw new Error(`Failed to create user profile: ${profileError.message}`)
    }
    console.log('✅ 用户配置创建成功')

    // 2. 获取默认免费订阅计划
    console.log('获取默认订阅计划...')
    const { data: defaultPlan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('id, name')
      .eq('is_default', true)
      .single()

    if (planError || !defaultPlan) {
      console.error('获取默认订阅计划失败:', planError)
      throw new Error(`Failed to get default plan: ${planError?.message || 'Plan not found'}`)
    }
    console.log('✅ 默认订阅计划获取成功:', defaultPlan.name)

    // 3. 为用户分配免费订阅计划
    console.log('分配订阅计划...')
    const { error: subscriptionError } = await supabaseClient
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: defaultPlan.id,
        status: 'active',
        current_period_start: new Date().toISOString(),
        // 免费计划没有结束时间
        current_period_end: null
      })

    if (subscriptionError) {
      console.error('分配订阅计划失败:', subscriptionError)
      throw new Error(`Failed to assign subscription: ${subscriptionError.message}`)
    }
    console.log('✅ 订阅计划分配成功')

    // 4. 初始化用户默认设置
    console.log('初始化用户设置...')
    const defaultSettings = [
      {
        user_id: userId,
        setting_key: 'theme',
        setting_value: { value: 'system' }
      },
      {
        user_id: userId,
        setting_key: 'currency',
        setting_value: { value: 'CNY' }
      },
      {
        user_id: userId,
        setting_key: 'notifications',
        setting_value: {
          email: true,
          renewal_reminders: true,
          payment_notifications: true
        }
      }
    ]

    const { error: settingsError } = await supabaseClient
      .from('user_settings')
      .insert(defaultSettings)

    if (settingsError) {
      console.error('初始化用户设置失败:', settingsError)
      // 设置失败不应该阻止用户注册，只记录警告
      console.warn('⚠️ 用户设置初始化失败，但用户注册成功')
    } else {
      console.log('✅ 用户设置初始化成功')
    }

    // 5. 发送欢迎邮件
    console.log('发送欢迎邮件...')
    try {
      // 获取用户显示名称
      const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('display_name')
        .eq('id', userId)
        .single()

      // 调用发送邮件的Edge Function
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          email: userEmail,
          displayName: profile?.display_name || userEmail.split('@')[0] || '用户'
        }),
      })

      if (emailResponse.ok) {
        const emailResult = await emailResponse.json()
        console.log('✅ 欢迎邮件发送成功:', emailResult.message)
      } else {
        const emailError = await emailResponse.text()
        console.warn('⚠️ 欢迎邮件发送失败:', emailError)
        // 邮件发送失败不应该阻止用户注册
      }
    } catch (emailError) {
      console.warn('⚠️ 调用邮件服务失败:', emailError)
      // 邮件发送失败不应该阻止用户注册
    }

    console.log('🎉 新用户初始化完成:', userId)

    return new Response(
      JSON.stringify({
        success: true,
        message: '用户初始化完成',
        userId,
        email: userEmail,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ 处理新用户注册失败:', error)

    // 返回详细的错误信息用于调试
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        // 在开发环境中包含更多调试信息
        // @ts-ignore - Deno runtime environment
        ...(Deno.env.get('ENVIRONMENT') === 'development' && {
          stack: error.stack,
          details: error
        })
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})