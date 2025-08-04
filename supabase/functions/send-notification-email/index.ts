// 通用邮件通知服务 Edge Function
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 邮件类型定义
type EmailType = 
  | 'welcome'
  | 'subscription_expiry'
  | 'payment_failed'
  | 'payment_success'
  | 'quota_warning'
  | 'security_alert'
  | 'system_update'
  | 'password_reset'

interface EmailRequest {
  userId: string
  email: string
  type: EmailType
  data?: Record<string, any>
  templateOverride?: {
    subject?: string
    html?: string
    text?: string
  }
}

interface EmailTemplate {
  subject: string
  html: string
  text: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 模板变量替换函数
function replaceTemplateVariables(template: string, variables: Record<string, any>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    result = result.replace(regex, String(value || ''))
  }
  return result
}

// 获取邮件模板
async function getEmailTemplate(
  supabaseClient: any,
  templateKey: string,
  variables: Record<string, any>
): Promise<EmailTemplate> {
  const { data: template, error } = await supabaseClient
    .from('email_templates')
    .select('subject_template, html_template, text_template')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .single()

  if (error || !template) {
    console.error('获取邮件模板失败:', error)
    // 返回默认模板
    return getDefaultTemplate(templateKey, variables)
  }

  return {
    subject: replaceTemplateVariables(template.subject_template, variables),
    html: replaceTemplateVariables(template.html_template, variables),
    text: replaceTemplateVariables(template.text_template, variables)
  }
}

// 默认模板（当数据库模板不可用时使用）
function getDefaultTemplate(type: string, variables: Record<string, any>): EmailTemplate {
  const { displayName = '用户' } = variables

  switch (type) {
    case 'welcome':
      return {
        subject: '欢迎使用订阅管理器！🎉',
        html: `<h1>欢迎 ${displayName}！</h1><p>感谢您注册订阅管理器。</p>`,
        text: `欢迎 ${displayName}！\n\n感谢您注册订阅管理器。`
      }
    case 'subscription_expiry':
      return {
        subject: '⏰ 订阅即将到期提醒',
        html: `<h1>订阅到期提醒</h1><p>您的订阅即将到期，请及时处理。</p>`,
        text: `订阅到期提醒\n\n您的订阅即将到期，请及时处理。`
      }
    case 'payment_failed':
      return {
        subject: '❌ 支付失败通知',
        html: `<h1>支付失败</h1><p>您的订阅支付失败，请检查支付信息。</p>`,
        text: `支付失败\n\n您的订阅支付失败，请检查支付信息。`
      }
    case 'payment_success':
      return {
        subject: '✅ 支付成功确认',
        html: `<h1>支付成功</h1><p>您的订阅支付成功。</p>`,
        text: `支付成功\n\n您的订阅支付成功。`
      }
    default:
      return {
        subject: '订阅管理器通知',
        html: `<h1>系统通知</h1><p>您有一条新的通知。</p>`,
        text: `系统通知\n\n您有一条新的通知。`
      }
  }
}

// 邮件发送状态跟踪
async function logEmailStatus(
  supabaseClient: any,
  userId: string,
  email: string,
  type: EmailType,
  status: 'sent' | 'failed' | 'pending',
  error?: string,
  emailId?: string
) {
  try {
    await supabaseClient
      .from('email_logs')
      .insert({
        user_id: userId,
        email_address: email,
        email_type: type,
        status,
        error_message: error,
        external_email_id: emailId,
        sent_at: new Date().toISOString()
      })
  } catch (dbError) {
    console.warn('⚠️ 记录邮件状态失败:', dbError)
  }
}

// 邮件服务提供商集成
async function sendWithResend(
  to: string,
  subject: string,
  html: string,
  text: string,
  apiKey: string
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('FROM_EMAIL') || 'noreply@service.lskun.top',
        to: [to],
        subject,
        html,
        text,
      }),
    })

    if (response.ok) {
      const result = await response.json()
      return { success: true, emailId: result.id }
    } else {
      const error = await response.text()
      return { success: false, error: `Resend API error: ${error}` }
    }
  } catch (error) {
    return { success: false, error: `Resend exception: ${error.message}` }
  }
}

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
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables')
    }

    // 获取请求数据
    const { userId, email, type, data = {}, templateOverride }: EmailRequest = await req.json()
    
    if (!userId || !email || !type) {
      throw new Error('Missing required fields: userId, email, and type')
    }

    console.log('发送邮件通知:', { userId, email, type })

    // 创建Supabase客户端
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 获取用户信息
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('display_name')
      .eq('id', userId)
      .single()

    const displayName = data.displayName || profile?.display_name || email.split('@')[0] || '用户'
    const emailData = { 
      ...data, 
      displayName, 
      email,
      siteUrl: Deno.env.get('SITE_URL') || 'https://your-domain.com'
    }

    // 生成邮件模板
    let emailTemplate: EmailTemplate
    if (templateOverride) {
      const defaultTemplate = await getEmailTemplate(supabaseClient, type, emailData)
      emailTemplate = {
        subject: templateOverride.subject || defaultTemplate.subject,
        html: templateOverride.html || defaultTemplate.html,
        text: templateOverride.text || defaultTemplate.text
      }
    } else {
      emailTemplate = await getEmailTemplate(supabaseClient, type, emailData)
    }

    // 记录邮件发送尝试
    await logEmailStatus(supabaseClient, userId, email, type, 'pending')

    // 发送邮件
    let emailResult = { success: false, emailId: undefined, error: 'No email service configured' }

    if (resendApiKey) {
      console.log('使用Resend发送邮件...')
      emailResult = await sendWithResend(
        email,
        emailTemplate.subject,
        emailTemplate.html,
        emailTemplate.text,
        resendApiKey
      )
    }

    // 更新邮件发送状态
    await logEmailStatus(
      supabaseClient,
      userId,
      email,
      type,
      emailResult.success ? 'sent' : 'failed',
      emailResult.error,
      emailResult.emailId
    )

    if (emailResult.success) {
      console.log('✅ 邮件发送成功:', emailResult.emailId)
    } else {
      console.error('❌ 邮件发送失败:', emailResult.error)
    }

    return new Response(
      JSON.stringify({
        success: emailResult.success,
        message: emailResult.success ? '邮件发送成功' : '邮件发送失败',
        emailId: emailResult.emailId,
        userId,
        email,
        type,
        timestamp: new Date().toISOString(),
        ...(emailResult.error && { error: emailResult.error })
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: emailResult.success ? 200 : 500,
      },
    )

  } catch (error) {
    console.error('❌ 邮件通知服务失败:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        ...(Deno.env.get('ENVIRONMENT') === 'development' && {
          stack: error.stack
        })
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})