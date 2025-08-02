#!/usr/bin/env tsx

/**
 * 部署汇率更新Edge Function的脚本
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { config } from 'dotenv'

// 加载环境变量
config()

console.log('🚀 Deploying Exchange Rate Update Edge Function...')

// 检查Supabase CLI是否安装
try {
  execSync('supabase --version', { stdio: 'pipe' })
  console.log('✅ Supabase CLI found')
} catch (error) {
  console.error('❌ Supabase CLI not found. Please install it first:')
  console.error('npm install -g supabase')
  process.exit(1)
}

// 检查Edge Function文件是否存在
const functionPath = 'supabase/functions/update-exchange-rates/index.ts'
if (!existsSync(functionPath)) {
  console.error(`❌ Edge Function file not found: ${functionPath}`)
  process.exit(1)
}

console.log('✅ Edge Function file found')

try {
  // 部署Edge Function
  console.log('📦 Deploying function...')
  execSync('supabase functions deploy update-exchange-rates', { 
    stdio: 'inherit',
    cwd: process.cwd()
  })
  
  console.log('✅ Edge Function deployed successfully!')
  
  // 测试函数是否可访问
  console.log('🧪 Testing function accessibility...')
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/update-exchange-rates?action=status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Function is accessible and responding')
        console.log('📊 Status:', JSON.stringify(data, null, 2))
      } else {
        console.log(`⚠️ Function responded with status: ${response.status}`)
      }
    } catch (error) {
      console.log('⚠️ Could not test function accessibility:', error)
    }
  } else {
    console.log('⚠️ Cannot test function - missing environment variables')
  }
  
  console.log('\n🎉 Deployment completed!')
  console.log('💡 You can now use the exchange rate update service')
  
} catch (error) {
  console.error('❌ Deployment failed:', error)
  process.exit(1)
}