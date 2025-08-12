# Edge Function部署指南

## 概述
本指南详细说明如何部署和配置 `handle-new-user` Edge Function。

## 部署步骤

### 方法1：通过Supabase Dashboard（推荐）

1. **登录Supabase Dashboard**
   - 访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - 选择你的项目

2. **进入Edge Functions**
   - 点击左侧菜单的 **Edge Functions**
   - 点击 **Create function**

3. **创建函数**
   - **Function name**: `handle-new-user`
   - **将以下代码复制粘贴到编辑器中**：

```typescript
// Edge Function for handling new user registration
// This function is called via Database Webhook when a new user is created

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

console.log('Hello from handle-new-user Function!')

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
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
```

4. **部署函数**
   - 点击 **Deploy function**
   - 等待部署完成

### 方法2：通过Supabase CLI

```bash
# 安装Supabase CLI
npm install -g supabase

# 登录
supabase login

# 链接项目
supabase link --project-ref your-project-id

# 部署函数
supabase functions deploy handle-new-user
```

## 配置Database Webhook

部署Edge Function后，配置Webhook：

1. **进入Database > Webhooks**
2. **点击 "Create a new hook"**
3. **配置参数**：
   - **Name**: `handle-new-user`
   - **Table**: `auth.users`
   - **Events**: 选择 `INSERT` ✅
   - **Type**: `HTTP Request`
   - **HTTP Request URL**: `https://你的项目ID.supabase.co/functions/v1/handle-new-user`
   - **HTTP Headers**:
     ```
     Content-Type: application/json
     Authorization: Bearer 你的SERVICE_ROLE_KEY
     ```

## 获取Service Role Key

1. **进入Settings > API**
2. **复制 "service_role" 密钥**（不是anon key）
3. **在Webhook配置中使用这个密钥**

## 测试Edge Function

### 1. 手动测试

```bash
# 添加Service Role Key到.env文件
echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key" >> .env

# 运行测试脚本
npm run test-edge-function
```

### 2. 通过用户注册测试

1. 启动应用：`npm run dev`
2. 访问 `/login` 页面
3. 注册新用户
4. 检查Supabase日志确认Edge Function被调用

## 监控和调试

### 查看Edge Function日志

1. **进入Edge Functions**
2. **选择 `handle-new-user` 函数**
3. **查看 Logs 标签页**

### 查看Webhook日志

1. **进入Database > Webhooks**
2. **点击你的Webhook**
3. **查看执行历史**

### 常见问题

1. **函数部署失败**
   - 检查代码语法
   - 确保导入的模块版本正确

2. **Webhook调用失败**
   - 检查Service Role Key是否正确
   - 确认函数URL是否正确

3. **用户初始化失败**
   - 检查数据库表是否存在
   - 确认RLS策略是否正确

## 完成检查清单

- [ ] Edge Function已部署
- [ ] Database Webhook已配置
- [ ] Service Role Key已设置
- [ ] 测试脚本运行成功
- [ ] 用户注册测试通过
- [ ] 日志显示正常执行

完成以上步骤后，新用户注册时会自动初始化用户数据。