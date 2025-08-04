// Edge Function for sending welcome emails to new users
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface EmailRequest {
  userId: string
  email: string
  displayName?: string
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
) {
  const { data: template, error } = await supabaseClient
    .from('email_templates')
    .select('subject_template, html_template, text_template')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .single()

  if (error || !template) {
    console.error('获取邮件模板失败:', error)
    // 返回默认模板
    return {
      subject: '欢迎使用订阅管理器！🎉',
      html: `<h1>欢迎 ${variables.displayName || '用户'}！</h1><p>感谢您注册订阅管理器。</p>`,
      text: `欢迎 ${variables.displayName || '用户'}！\n\n感谢您注册订阅管理器。`
    }
  }

  return {
    subject: replaceTemplateVariables(template.subject_template, variables),
    html: replaceTemplateVariables(template.html_template, variables),
    text: replaceTemplateVariables(template.text_template, variables)
  }
}

// 记录邮件发送状态
async function logEmailStatus(
  supabaseClient: any,
  userId: string,
  email: string,
  status: 'pending' | 'sent' | 'failed',
  error?: string,
  emailId?: string
) {
  try {
    await supabaseClient
      .from('email_logs')
      .insert({
        user_id: userId,
        email_address: email,
        email_type: 'welcome',
        status,
        error_message: error,
        external_email_id: emailId,
        sent_at: new Date().toISOString()
      })
  } catch (dbError) {
    console.warn('⚠️ 记录邮件状态失败:', dbError)
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
    const { userId, email, displayName }: EmailRequest = await req.json()
    
    if (!userId || !email) {
      throw new Error('Missing required fields: userId and email')
    }

    console.log('发送欢迎邮件:', { userId, email, displayName })

    // 创建Supabase客户端
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 获取用户信息（如果没有提供displayName）
    let finalDisplayName = displayName
    if (!finalDisplayName) {
      const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('display_name')
        .eq('id', userId)
        .single()
      
      finalDisplayName = profile?.display_name || email.split('@')[0] || '用户'
    }

    // 准备模板变量
    const templateVariables = {
      displayName: finalDisplayName,
      email,
      siteUrl: Deno.env.get('SITE_URL') || 'https://your-domain.com',
      dashboardUrl: `${Deno.env.get('SITE_URL') || 'https://your-domain.com'}/dashboard`
    }

    // 从数据库获取邮件模板
    const emailTemplate = await getEmailTemplate(supabaseClient, 'welcome', templateVariables)

    // 记录邮件发送尝试
    await logEmailStatus(supabaseClient, userId, email, 'pending')

    // 发送邮件的逻辑
    let emailSent = false
    let emailError = null
    let emailId = null

    // 如果配置了Resend API Key，使用Resend发送邮件
    if (resendApiKey) {
      try {
        console.log('使用Resend发送邮件...')
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: Deno.env.get('FROM_EMAIL') || 'noreply@service.lskun.top',
            to: [email],
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            text: emailTemplate.text,
          }),
        })

        if (resendResponse.ok) {
          const result = await resendResponse.json()
          console.log('✅ Resend邮件发送成功:', result.id)
          emailSent = true
          emailId = result.id
        } else {
          const error = await resendResponse.text()
          console.error('❌ Resend邮件发送失败:', error)
          emailError = `Resend API error: ${error}`
        }
      } catch (error) {
        console.error('❌ Resend邮件发送异常:', error)
        emailError = `Resend exception: ${error.message}`
      }
    }

    // 如果Resend失败或未配置，记录日志
    if (!emailSent) {
      console.log('📧 邮件内容已生成，但未配置邮件服务')
      console.log('邮件主题:', emailTemplate.subject)
      console.log('收件人:', email)
      
      if (Deno.env.get('ENVIRONMENT') === 'development') {
        console.log('开发环境 - 邮件内容预览:')
        console.log('HTML内容长度:', emailTemplate.html.length)
        console.log('文本内容长度:', emailTemplate.text.length)
      }
    }

    // 更新邮件发送状态
    await logEmailStatus(
      supabaseClient,
      userId,
      email,
      emailSent ? 'sent' : 'failed',
      emailError,
      emailId
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent ? '欢迎邮件发送成功' : '欢迎邮件已准备，但邮件服务未配置',
        emailSent,
        emailId,
        userId,
        email,
        displayName: finalDisplayName,
        timestamp: new Date().toISOString(),
        ...(emailError && { emailError })
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ 发送欢迎邮件失败:', error)

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