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

// 邮件模板管理系统
class EmailTemplateManager {
  private static getBaseTemplate(content: string, title: string): string {
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
          }
          .container {
            background-color: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          .title {
            font-size: 28px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 10px;
          }
          .content {
            margin-bottom: 30px;
          }
          .cta-button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            text-align: center;
            margin: 20px 0;
          }
          .alert {
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .alert-info {
            background-color: #f0f9ff;
            border-left: 4px solid #2563eb;
          }
          .alert-warning {
            background-color: #fffbeb;
            border-left: 4px solid #f59e0b;
          }
          .alert-error {
            background-color: #fef2f2;
            border-left: 4px solid #ef4444;
          }
          .alert-success {
            background-color: #f0fdf4;
            border-left: 4px solid #10b981;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">📊 订阅管理器</div>
            <h1 class="title">${title}</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>如果您有任何问题或建议，请随时联系我们。</p>
            <p><strong>订阅管理器团队</strong></p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #9ca3af;">
              如果您不希望接收此类邮件，可以在设置中关闭邮件通知。
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  static getTemplate(type: EmailType, data: Record<string, any> = {}): EmailTemplate {
    const { displayName = '用户', email = '' } = data

    switch (type) {
      case 'welcome':
        return {
          subject: '欢迎使用订阅管理器！🎉',
          html: this.getBaseTemplate(`
            <p>亲爱的 <strong>${displayName}</strong>，</p>
            <p>恭喜您成功注册订阅管理器！我们很高兴为您提供专业的订阅管理服务。</p>
            <div class="alert alert-info">
              <strong>💡 快速开始提示：</strong>
              <ul>
                <li>添加您的第一个订阅服务</li>
                <li>设置续费提醒，避免意外扣费</li>
                <li>查看费用分析，了解支出情况</li>
                <li>自定义分类，更好地管理订阅</li>
              </ul>
            </div>
            <div style="text-align: center;">
              <a href="${Deno.env.get('SITE_URL') || 'https://your-domain.com'}/dashboard" class="cta-button">
                立即开始使用 →
              </a>
            </div>
          `, '欢迎加入我们！'),
          text: `欢迎使用订阅管理器！\n\n亲爱的 ${displayName}，\n\n恭喜您成功注册订阅管理器！我们很高兴为您提供专业的订阅管理服务。\n\n立即开始使用：${Deno.env.get('SITE_URL') || 'https://your-domain.com'}/dashboard`
        }

      case 'subscription_expiry':
        const { subscriptionName = '订阅服务', expiryDate = '即将', daysLeft = 0 } = data
        return {
          subject: `⏰ ${subscriptionName} 即将到期提醒`,
          html: this.getBaseTemplate(`
            <p>亲爱的 <strong>${displayName}</strong>，</p>
            <p>您的订阅服务 <strong>${subscriptionName}</strong> 将在 <strong>${daysLeft}</strong> 天后到期（${expiryDate}）。</p>
            <div class="alert alert-warning">
              <strong>⚠️ 重要提醒：</strong>
              <p>为了避免服务中断，请及时处理续费或取消订阅。</p>
            </div>
            <div style="text-align: center;">
              <a href="${Deno.env.get('SITE_URL') || 'https://your-domain.com'}/subscriptions" class="cta-button">
                管理订阅 →
              </a>
            </div>
          `, '订阅即将到期'),
          text: `订阅即将到期提醒\n\n亲爱的 ${displayName}，\n\n您的订阅服务 ${subscriptionName} 将在 ${daysLeft} 天后到期（${expiryDate}）。\n\n请及时处理续费或取消订阅。`
        }

      case 'payment_failed':
        const { subscriptionName: failedSub = '订阅服务', amount = '0', currency = 'CNY' } = data
        return {
          subject: `❌ ${failedSub} 支付失败通知`,
          html: this.getBaseTemplate(`
            <p>亲爱的 <strong>${displayName}</strong>，</p>
            <p>您的订阅服务 <strong>${failedSub}</strong> 支付失败，金额：${amount} ${currency}。</p>
            <div class="alert alert-error">
              <strong>🚨 支付失败原因可能包括：</strong>
              <ul>
                <li>银行卡余额不足</li>
                <li>银行卡已过期</li>
                <li>支付信息有误</li>
                <li>银行风控拦截</li>
              </ul>
            </div>
            <div style="text-align: center;">
              <a href="${Deno.env.get('SITE_URL') || 'https://your-domain.com'}/subscriptions" class="cta-button">
                更新支付信息 →
              </a>
            </div>
          `, '支付失败通知'),
          text: `支付失败通知\n\n亲爱的 ${displayName}，\n\n您的订阅服务 ${failedSub} 支付失败，金额：${amount} ${currency}。\n\n请检查支付信息并重试。`
        }

      case 'payment_success':
        const { subscriptionName: successSub = '订阅服务', amount: successAmount = '0', currency: successCurrency = 'CNY' } = data
        return {
          subject: `✅ ${successSub} 支付成功确认`,
          html: this.getBaseTemplate(`
            <p>亲爱的 <strong>${displayName}</strong>，</p>
            <p>您的订阅服务 <strong>${successSub}</strong> 支付成功，金额：${successAmount} ${successCurrency}。</p>
            <div class="alert alert-success">
              <strong>✅ 支付详情：</strong>
              <ul>
                <li>服务名称：${successSub}</li>
                <li>支付金额：${successAmount} ${successCurrency}</li>
                <li>支付时间：${new Date().toLocaleString('zh-CN')}</li>
              </ul>
            </div>
            <div style="text-align: center;">
              <a href="${Deno.env.get('SITE_URL') || 'https://your-domain.com'}/payment-history" class="cta-button">
                查看支付历史 →
              </a>
            </div>
          `, '支付成功确认'),
          text: `支付成功确认\n\n亲爱的 ${displayName}，\n\n您的订阅服务 ${successSub} 支付成功，金额：${successAmount} ${successCurrency}。`
        }

      case 'quota_warning':
        const { feature = '功能', currentUsage = 0, limit = 100, percentage = 80 } = data
        return {
          subject: `⚠️ 使用配额警告 - ${feature}`,
          html: this.getBaseTemplate(`
            <p>亲爱的 <strong>${displayName}</strong>，</p>
            <p>您的 <strong>${feature}</strong> 使用量已达到 <strong>${percentage}%</strong>（${currentUsage}/${limit}）。</p>
            <div class="alert alert-warning">
              <strong>📊 使用情况：</strong>
              <p>当前使用：${currentUsage} / ${limit}</p>
              <p>使用率：${percentage}%</p>
            </div>
            <p>为了避免服务中断，建议您考虑升级订阅计划。</p>
            <div style="text-align: center;">
              <a href="${Deno.env.get('SITE_URL') || 'https://your-domain.com'}/settings" class="cta-button">
                查看使用情况 →
              </a>
            </div>
          `, '使用配额警告'),
          text: `使用配额警告\n\n亲爱的 ${displayName}，\n\n您的 ${feature} 使用量已达到 ${percentage}%（${currentUsage}/${limit}）。\n\n建议您考虑升级订阅计划。`
        }

      case 'security_alert':
        const { alertType = '安全警告', details = '检测到异常活动' } = data
        return {
          subject: `🔒 安全警告 - ${alertType}`,
          html: this.getBaseTemplate(`
            <p>亲爱的 <strong>${displayName}</strong>，</p>
            <p>我们检测到您的账户存在以下安全问题：</p>
            <div class="alert alert-error">
              <strong>🚨 安全警告：</strong>
              <p>${details}</p>
              <p>时间：${new Date().toLocaleString('zh-CN')}</p>
            </div>
            <p>如果这不是您的操作，请立即更改密码并联系我们。</p>
            <div style="text-align: center;">
              <a href="${Deno.env.get('SITE_URL') || 'https://your-domain.com'}/settings/security" class="cta-button">
                检查安全设置 →
              </a>
            </div>
          `, '安全警告'),
          text: `安全警告\n\n亲爱的 ${displayName}，\n\n我们检测到您的账户存在安全问题：${details}\n\n如果这不是您的操作，请立即更改密码。`
        }

      case 'system_update':
        const { updateTitle = '系统更新', updateContent = '我们发布了新功能' } = data
        return {
          subject: `🚀 系统更新通知 - ${updateTitle}`,
          html: this.getBaseTemplate(`
            <p>亲爱的 <strong>${displayName}</strong>，</p>
            <p>我们很高兴地通知您，订阅管理器有新的更新！</p>
            <div class="alert alert-info">
              <strong>🆕 更新内容：</strong>
              <p>${updateContent}</p>
            </div>
            <div style="text-align: center;">
              <a href="${Deno.env.get('SITE_URL') || 'https://your-domain.com'}/dashboard" class="cta-button">
                立即体验 →
              </a>
            </div>
          `, '系统更新通知'),
          text: `系统更新通知\n\n亲爱的 ${displayName}，\n\n订阅管理器有新的更新：${updateContent}`
        }

      case 'password_reset':
        const { resetLink = '#', expiryTime = '1小时' } = data
        return {
          subject: '🔑 密码重置请求',
          html: this.getBaseTemplate(`
            <p>亲爱的 <strong>${displayName}</strong>，</p>
            <p>我们收到了您的密码重置请求。</p>
            <div class="alert alert-info">
              <strong>🔐 重置说明：</strong>
              <ul>
                <li>点击下方按钮重置密码</li>
                <li>链接有效期：${expiryTime}</li>
                <li>如果不是您的操作，请忽略此邮件</li>
              </ul>
            </div>
            <div style="text-align: center;">
              <a href="${resetLink}" class="cta-button">
                重置密码 →
              </a>
            </div>
          `, '密码重置请求'),
          text: `密码重置请求\n\n亲爱的 ${displayName}，\n\n我们收到了您的密码重置请求。\n\n重置链接：${resetLink}\n\n链接有效期：${expiryTime}`
        }

      default:
        return {
          subject: '订阅管理器通知',
          html: this.getBaseTemplate(`
            <p>亲爱的 <strong>${displayName}</strong>，</p>
            <p>您有一条新的通知。</p>
          `, '系统通知'),
          text: `订阅管理器通知\n\n亲爱的 ${displayName}，\n\n您有一条新的通知。`
        }
    }
  }
}

// 邮件发送状态跟踪
class EmailStatusTracker {
  private supabaseClient: any

  constructor(supabaseClient: any) {
    this.supabaseClient = supabaseClient
  }

  async logEmailStatus(
    userId: string,
    email: string,
    type: EmailType,
    status: 'sent' | 'failed' | 'pending',
    error?: string,
    emailId?: string
  ) {
    try {
      await this.supabaseClient
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

  async updateEmailStatus(
    userId: string,
    emailId: string,
    status: 'delivered' | 'bounced' | 'complained',
    metadata?: Record<string, any>
  ) {
    try {
      await this.supabaseClient
        .from('email_logs')
        .update({
          status,
          metadata,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('external_email_id', emailId)
    } catch (dbError) {
      console.warn('⚠️ 更新邮件状态失败:', dbError)
    }
  }
}

// 邮件服务提供商集成
class EmailServiceProvider {
  static async sendWithResend(
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
          from: Deno.env.get('FROM_EMAIL') || 'noreply@your-domain.com',
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

  // 可以添加其他邮件服务提供商的集成
  static async sendWithSendGrid(
    to: string,
    subject: string,
    html: string,
    text: string,
    apiKey: string
  ): Promise<{ success: boolean; emailId?: string; error?: string }> {
    // SendGrid 集成实现
    // 这里可以添加 SendGrid 的具体实现
    return { success: false, error: 'SendGrid integration not implemented' }
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

    // 创建邮件状态跟踪器
    const statusTracker = new EmailStatusTracker(supabaseClient)

    // 获取用户信息
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('display_name')
      .eq('id', userId)
      .single()

    const displayName = data.displayName || profile?.display_name || email.split('@')[0] || '用户'
    const emailData = { ...data, displayName, email }

    // 生成邮件模板
    let emailTemplate: EmailTemplate
    if (templateOverride) {
      const defaultTemplate = EmailTemplateManager.getTemplate(type, emailData)
      emailTemplate = {
        subject: templateOverride.subject || defaultTemplate.subject,
        html: templateOverride.html || defaultTemplate.html,
        text: templateOverride.text || defaultTemplate.text
      }
    } else {
      emailTemplate = EmailTemplateManager.getTemplate(type, emailData)
    }

    // 记录邮件发送尝试
    await statusTracker.logEmailStatus(userId, email, type, 'pending')

    // 发送邮件
    let emailResult = { success: false, emailId: undefined, error: 'No email service configured' }

    if (resendApiKey) {
      console.log('使用Resend发送邮件...')
      emailResult = await EmailServiceProvider.sendWithResend(
        email,
        emailTemplate.subject,
        emailTemplate.html,
        emailTemplate.text,
        resendApiKey
      )
    }

    // 更新邮件发送状态
    await statusTracker.logEmailStatus(
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