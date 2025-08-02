#!/usr/bin/env node

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

const FUNCTION_NAME = 'subscriptions-management'
const FUNCTION_PATH = `supabase/functions/${FUNCTION_NAME}`

console.log('🚀 部署 Subscriptions Management Edge Function...')

// 检查函数文件是否存在
if (!existsSync(path.join(process.cwd(), FUNCTION_PATH, 'index.ts'))) {
  console.error(`❌ 函数文件不存在: ${FUNCTION_PATH}/index.ts`)
  process.exit(1)
}

try {
  // 检查 Supabase CLI 是否已安装
  console.log('📋 检查 Supabase CLI...')
  execSync('supabase --version', { stdio: 'pipe' })
  console.log('✅ Supabase CLI 已安装')

  // 检查是否已登录
  console.log('🔐 检查登录状态...')
  try {
    execSync('supabase projects list', { stdio: 'pipe' })
    console.log('✅ 已登录 Supabase')
  } catch (error) {
    console.log('⚠️  未登录，请先运行: supabase login')
    process.exit(1)
  }

  // 部署函数
  console.log(`📦 部署函数: ${FUNCTION_NAME}...`)
  const deployCommand = `supabase functions deploy ${FUNCTION_NAME}`
  
  console.log(`执行命令: ${deployCommand}`)
  execSync(deployCommand, { 
    stdio: 'inherit',
    cwd: process.cwd()
  })

  console.log('✅ Subscriptions Management Edge Function 部署成功!')
  console.log('')
  console.log('📝 部署信息:')
  console.log(`   函数名称: ${FUNCTION_NAME}`)
  console.log(`   函数路径: ${FUNCTION_PATH}`)
  console.log('')
  console.log('🔧 使用方法:')
  console.log('   在前端代码中调用:')
  console.log(`   supabase.functions.invoke('${FUNCTION_NAME}', { body: requestData })`)
  console.log('')
  console.log('📊 功能特性:')
  console.log('   ✓ 获取所有订阅数据')
  console.log('   ✓ 汇率转换支持')
  console.log('   ✓ 分类和支付方式数据')
  console.log('   ✓ 过滤和排序功能')
  console.log('   ✓ 搜索功能')
  console.log('   ✓ 统计摘要')

} catch (error) {
  console.error('❌ 部署失败:', error)
  console.log('')
  console.log('🔍 故障排除:')
  console.log('1. 确保已安装 Supabase CLI: npm install -g supabase')
  console.log('2. 确保已登录: supabase login')
  console.log('3. 确保项目已链接: supabase link --project-ref YOUR_PROJECT_REF')
  console.log('4. 检查函数代码语法是否正确')
  process.exit(1)
}