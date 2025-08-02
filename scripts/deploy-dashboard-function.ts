#!/usr/bin/env tsx

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

/**
 * 部署 Dashboard Analytics Edge Function
 */
async function deployDashboardFunction() {
  console.log('🚀 开始部署 Dashboard Analytics Edge Function...')

  try {
    // 检查 Supabase CLI 是否安装
    try {
      execSync('supabase --version', { stdio: 'pipe' })
    } catch (error) {
      console.error('❌ Supabase CLI 未安装或不在 PATH 中')
      console.log('请先安装 Supabase CLI: https://supabase.com/docs/guides/cli')
      process.exit(1)
    }

    // 检查函数文件是否存在
    const functionPath = path.join(process.cwd(), 'supabase/functions/dashboard-analytics/index.ts')
    if (!existsSync(functionPath)) {
      console.error('❌ Edge Function 文件不存在:', functionPath)
      process.exit(1)
    }

    console.log('📁 检查函数文件:', functionPath)

    // 检查 Supabase 项目状态
    console.log('🔍 检查 Supabase 项目状态...')
    try {
      execSync('supabase status', { stdio: 'pipe' })
    } catch (error) {
      console.log('⚠️  本地 Supabase 未启动，尝试启动...')
      try {
        execSync('supabase start', { stdio: 'inherit' })
      } catch (startError) {
        console.error('❌ 无法启动本地 Supabase')
        console.log('请确保 Docker 已安装并运行')
        process.exit(1)
      }
    }

    // 部署函数到本地环境
    console.log('📦 部署函数到本地环境...')
    execSync('supabase functions deploy dashboard-analytics --no-verify-jwt', { 
      stdio: 'inherit',
      cwd: process.cwd()
    })

    console.log('✅ Dashboard Analytics Edge Function 部署成功!')
    console.log('')
    console.log('📋 部署信息:')
    console.log('   函数名称: dashboard-analytics')
    console.log('   本地URL: http://localhost:54321/functions/v1/dashboard-analytics')
    console.log('')
    console.log('🧪 测试函数:')
    console.log('   curl -X POST http://localhost:54321/functions/v1/dashboard-analytics \\')
    console.log('     -H "Authorization: Bearer YOUR_JWT_TOKEN" \\')
    console.log('     -H "Content-Type: application/json" \\')
    console.log('     -d \'{"targetCurrency": "CNY"}\'')
    console.log('')
    console.log('📝 生产环境部署:')
    console.log('   supabase functions deploy dashboard-analytics --project-ref YOUR_PROJECT_REF')

  } catch (error) {
    console.error('❌ 部署失败:', error)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  deployDashboardFunction()
}

export { deployDashboardFunction }