#!/usr/bin/env tsx

/**
 * 部署 expense-reports Edge Function 脚本
 * 
 * 这个脚本用于部署 expense-reports edge function 到 Supabase
 * 
 * 使用方法:
 * npm run deploy:expense-reports
 * 或
 * npx tsx scripts/deploy-expense-reports-function.ts
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

const FUNCTION_NAME = 'expense-reports'
const FUNCTION_PATH = path.join(process.cwd(), 'supabase', 'functions', FUNCTION_NAME)

console.log('🚀 开始部署 expense-reports Edge Function...')

// 检查函数文件是否存在
if (!existsSync(FUNCTION_PATH)) {
  console.error(`❌ 错误: 找不到函数目录 ${FUNCTION_PATH}`)
  process.exit(1)
}

if (!existsSync(path.join(FUNCTION_PATH, 'index.ts'))) {
  console.error(`❌ 错误: 找不到函数入口文件 ${FUNCTION_PATH}/index.ts`)
  process.exit(1)
}

try {
  console.log(`📁 函数路径: ${FUNCTION_PATH}`)
  
  // 部署函数
  console.log('📦 正在部署函数...')
  execSync(`supabase functions deploy ${FUNCTION_NAME}`, {
    stdio: 'inherit',
    cwd: process.cwd()
  })
  
  console.log('✅ expense-reports Edge Function 部署成功!')
  console.log('')
  console.log('📋 部署信息:')
  console.log(`   函数名称: ${FUNCTION_NAME}`)
  console.log(`   函数路径: ${FUNCTION_PATH}`)
  console.log('')
  console.log('🔧 使用方法:')
  console.log('   在前端代码中调用 expenseReportsEdgeFunctionService 来使用这个函数')
  console.log('')
  console.log('📚 相关文件:')
  console.log('   - src/services/expenseReportsEdgeFunctionService.ts')
  console.log('   - src/hooks/useExpenseReportsData.ts')
  console.log('   - src/pages/ExpenseReportsPage.tsx')

} catch (error) {
  console.error('❌ 部署失败:', error)
  process.exit(1)
}