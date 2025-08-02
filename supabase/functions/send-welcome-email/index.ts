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

// 邮件模板
const getWelcomeEmailTemplate = (displayName: string, email: string) => {
  return {
    subject: '欢迎使用订阅管理器！🎉',
    html: `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>欢迎使用订阅管理器</title>
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
          .subtitle {
            font-size: 16px;
            color: #6b7280;
            margin-bottom: 30px;
          }
          .content {
            margin-bottom: 30px;
          }
          .feature-list {
            list-style: none;
            padding: 0;
            margin: 20px 0;
          }
          .feature-list li {
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
          }
          .feature-list li:last-child {
            border-bottom: none;
          }
          .feature-icon {
            color: #10b981;
            margin-right: 10px;
            font-weight: bold;
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
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          .tips {
            background-color: #f0f9ff;
            border-left: 4px solid #2563eb;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">📊 订阅管理器</div>
            <h1 class="title">欢迎加入我们！</h1>
            <p class="subtitle">感谢您选择订阅管理器，让我们一起开始智能管理您的订阅服务</p>
          </div>

          <div class="content">
            <p>亲爱的 <strong>${displayName}</strong>，</p>
            
            <p>恭喜您成功注册订阅管理器！我们很高兴为您提供专业的订阅管理服务。</p>

            <div class="tips">
              <strong>💡 快速开始提示：</strong>
              <ul class="feature-list">
                <li><span class="feature-icon">✅</span> 添加您的第一个订阅服务</li>
                <li><span class="feature-icon">✅</span> 设置续费提醒，避免意外扣费</li>
                <li><span class="feature-icon">✅</span> 查看费用分析，了解支出情况</li>
                <li><span class="feature-icon">✅</span> 自定义分类，更好地管理订阅</li>
              </ul>
            </div>

            <h3>🚀 您现在可以享受的功能：</h3>
            <ul class="feature-list">
              <li><span class="feature-icon">📱</span> 无限制添加和管理订阅</li>
              <li><span class="feature-icon">📊</span> 详细的费用分析和趋势图表</li>
              <li><span class="feature-icon">🔔</span> 智能续费提醒</li>
              <li><span class="feature-icon">💱</span> 多币种支持和实时汇率</li>
              <li><span class="feature-icon">📤</span> 数据导入导出功能</li>
              <li><span class="feature-icon">🎨</span> 个性化主题和设置</li>
            </ul>

            <div style="text-align: center;">
              <a href="${Deno.env.get('SITE_URL') || 'https://your-domain.com'}/dashboard" class="cta-button">
                立即开始使用 →
              </a>
            </div>

            <h3>📚 使用指南：</h3>
            <p>如果您是第一次使用，建议您：</p>
            <ol>
              <li><strong>完善个人资料</strong> - 在设置页面更新您的显示名称和偏好</li>
              <li><strong>添加订阅</strong> - 点击"添加订阅"按钮，输入您的第一个订阅服务</li>
              <li><strong>设置提醒</strong> - 开启续费提醒，避免忘记取消不需要的服务</li>
              <li><strong>查看分析</strong> - 在报告页面查看您的支出分析和趋势</li>
            </ol>

            <div class="tips">
              <strong>💰 省钱小贴士：</strong><br>
              定期检查您的订阅列表，取消不再使用的服务。平均每个用户通过我们的工具每月可以节省30%的订阅费用！
            </div>
          </div>

          <div class="footer">
            <p>如果您有任何问题或建议，请随时联系我们。</p>
            <p>祝您使用愉快！</p>
            <p><strong>订阅管理器团队</strong></p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #9ca3af;">
              此邮件发送至：${email}<br>
              如果您不希望接收此类邮件，可以在设置中关闭邮件通知。
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
欢迎使用订阅管理器！

亲爱的 ${displayName}，

恭喜您成功注册订阅管理器！我们很高兴为您提供专业的订阅管理服务。

您现在可以享受的功能：
• 无限制添加和管理订阅
• 详细的费用分析和趋势图表
• 智能续费提醒
• 多币种支持和实时汇率
• 数据导入导出功能
• 个性化主题和设置

快速开始：
1. 完善个人资料 - 在设置页面更新您的显示名称和偏好
2. 添加订阅 - 点击"添加订阅"按钮，输入您的第一个订阅服务
3. 设置提醒 - 开启续费提醒，避免忘记取消不需要的服务
4. 查看分析 - 在报告页面查看您的支出分析和趋势

立即开始使用：${Deno.env.get('SITE_URL') || 'https://your-domain.com'}/dashboard

如果您有任何问题或建议，请随时联系我们。

祝您使用愉快！
订阅管理器团队
    `
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

    // 生成邮件内容
    const emailTemplate = getWelcomeEmailTemplate(finalDisplayName, email)

    // 发送邮件的逻辑
    let emailSent = false
    let emailError = null

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
            from: Deno.env.get('FROM_EMAIL') || 'noreply@your-domain.com',
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

    // 如果Resend失败或未配置，尝试其他邮件服务或记录日志
    if (!emailSent) {
      console.log('📧 邮件内容已生成，但未配置邮件服务')
      console.log('邮件主题:', emailTemplate.subject)
      console.log('收件人:', email)
      
      // 在开发环境中，可以将邮件内容保存到数据库或日志
      if (Deno.env.get('ENVIRONMENT') === 'development') {
        console.log('开发环境 - 邮件内容预览:')
        console.log('HTML内容长度:', emailTemplate.html.length)
        console.log('文本内容长度:', emailTemplate.text.length)
      }
    }

    // 记录邮件发送状态到数据库（可选）
    try {
      await supabaseClient
        .from('user_settings')
        .upsert({
          user_id: userId,
          setting_key: 'welcome_email_sent',
          setting_value: {
            sent: emailSent,
            timestamp: new Date().toISOString(),
            error: emailError
          }
        })
    } catch (dbError) {
      console.warn('⚠️ 记录邮件状态失败:', dbError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent ? '欢迎邮件发送成功' : '欢迎邮件已准备，但邮件服务未配置',
        emailSent,
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
        // 在开发环境中包含更多调试信息
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