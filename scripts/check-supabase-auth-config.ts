#!/usr/bin/env tsx

/**
 * 检查和配置 Supabase 认证设置
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少 Supabase 环境变量')
  console.log('请确保 .env 文件中包含:')
  console.log('- VITE_SUPABASE_URL')
  console.log('- VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkAuthConfig() {
  console.log('🔍 检查 Supabase 认证配置...')
  
  try {
    // 检查当前认证设置
    console.log('\n📋 当前认证配置:')
    console.log('- Supabase URL:', supabaseUrl)
    console.log('- 匿名密钥已配置:', !!supabaseAnonKey)
    
    // 测试连接
    console.log('\n🔗 测试 Supabase 连接...')
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('❌ 连接失败:', error.message)
      return
    }
    
    console.log('✅ 连接成功')
    
    // 检查邮箱确认设置
    console.log('\n📧 邮箱确认设置检查:')
    console.log('注意：邮箱确认设置需要在 Supabase Dashboard 中配置')
    console.log('路径：Authentication > Settings > Email Auth')
    console.log('- Enable email confirmations: 应该启用')
    console.log('- Confirm email change: 建议启用')
    console.log('- Enable secure email change: 建议启用')
    
    // 检查重定向URL设置
    console.log('\n🔄 重定向URL设置检查:')
    console.log('需要在 Supabase Dashboard 中添加以下重定向URL:')
    console.log('路径：Authentication > URL Configuration')
    console.log('- Site URL: http://localhost:5174')
    console.log('- Redirect URLs:')
    console.log('  - http://localhost:5174/auth/callback')
    console.log('  - http://localhost:5174/auth/reset-password')
    
    // 测试注册流程
    console.log('\n🧪 测试注册流程...')
    const testEmail = `test${Date.now()}@gmail.com`
    const testPassword = 'test123456'
    
    console.log(`尝试注册测试用户: ${testEmail}`)
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        emailRedirectTo: 'http://localhost:5174/auth/callback'
      }
    })
    
    if (signUpError) {
      console.error('❌ 注册测试失败:', signUpError.message)
      return
    }
    
    console.log('✅ 注册测试成功')
    console.log('- 用户ID:', signUpData.user?.id)
    console.log('- 邮箱:', signUpData.user?.email)
    console.log('- 邮箱已确认:', signUpData.user?.email_confirmed_at ? '是' : '否')
    console.log('- 会话存在:', signUpData.session ? '是' : '否')
    
    if (signUpData.user && !signUpData.session) {
      console.log('✅ 邮箱确认已启用 - 用户需要确认邮箱才能登录')
    } else if (signUpData.user && signUpData.session) {
      console.log('⚠️  邮箱确认已禁用 - 用户可以直接登录')
    }
    
    // 清理测试用户
    if (signUpData.user?.id) {
      console.log('\n🧹 清理测试用户...')
      try {
        // 注意：这需要服务角色密钥，在生产环境中不应该这样做
        // 这里只是为了演示，实际应该通过 Supabase Dashboard 手动删除
        console.log('请手动在 Supabase Dashboard 中删除测试用户:', testEmail)
      } catch (cleanupError) {
        console.log('测试用户清理失败，请手动删除:', testEmail)
      }
    }
    
    console.log('\n✅ 配置检查完成')
    
  } catch (error) {
    console.error('❌ 检查过程中出现错误:', error)
  }
}

// 运行检查
checkAuthConfig().catch(console.error)