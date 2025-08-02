#!/usr/bin/env node

/**
 * Supabase配置检查脚本
 * 用于验证Supabase项目配置是否正确
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
dotenv.config({ path: join(__dirname, '../.env') })

const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
]

const REQUIRED_TABLES = [
  'user_profiles',
  'subscription_plans',
  'user_subscriptions',
  'categories',
  'payment_methods',
  'subscriptions',
  'payment_history',
  'exchange_rates',
  'user_settings'
]

async function checkEnvironmentVariables() {
  console.log('🔍 检查环境变量...')
  
  const missingVars = REQUIRED_ENV_VARS.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.error('❌ 缺少必要的环境变量:')
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`)
    })
    return false
  }
  
  console.log('✅ 环境变量配置正确')
  return true
}

async function checkSupabaseConnection() {
  console.log('🔍 检查Supabase连接...')
  
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )
    
    // 测试连接
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Supabase连接失败:', error.message)
      return false
    }
    
    console.log('✅ Supabase连接正常')
    return true
  } catch (error) {
    console.error('❌ Supabase连接异常:', error.message)
    return false
  }
}

async function checkDatabaseTables() {
  console.log('🔍 检查数据库表结构...')
  
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )
    
    const missingTables = []
    
    for (const tableName of REQUIRED_TABLES) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)
        
        if (error && error.code === 'PGRST116') {
          // 表存在但RLS阻止访问（这是正常的）
          continue
        } else if (error && error.code === '42P01') {
          // 表不存在
          missingTables.push(tableName)
        } else if (error) {
          console.warn(`⚠️  表 ${tableName} 检查时出现警告:`, error.message)
        }
      } catch (err) {
        console.warn(`⚠️  无法检查表 ${tableName}:`, err.message)
      }
    }
    
    if (missingTables.length > 0) {
      console.error('❌ 缺少必要的数据库表:')
      missingTables.forEach(tableName => {
        console.error(`   - ${tableName}`)
      })
      console.error('\n请运行数据库迁移脚本创建表结构')
      return false
    }
    
    console.log('✅ 数据库表结构正常')
    return true
  } catch (error) {
    console.error('❌ 检查数据库表失败:', error.message)
    return false
  }
}

async function checkAuthConfiguration() {
  console.log('🔍 检查认证配置...')
  
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )
    
    // 检查是否可以获取会话（不需要实际登录）
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('❌ 认证配置错误:', error.message)
      return false
    }
    
    console.log('✅ 认证配置正常')
    return true
  } catch (error) {
    console.error('❌ 检查认证配置失败:', error.message)
    return false
  }
}

async function checkDefaultData() {
  console.log('🔍 检查默认数据...')
  
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )
    
    // 检查默认订阅计划
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_default', true)
    
    if (plansError) {
      console.error('❌ 无法检查默认订阅计划:', plansError.message)
      return false
    }
    
    if (!plans || plans.length === 0) {
      console.error('❌ 缺少默认订阅计划')
      return false
    }
    
    // 检查默认分类
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .eq('is_default', true)
    
    if (categoriesError) {
      console.error('❌ 无法检查默认分类:', categoriesError.message)
      return false
    }
    
    if (!categories || categories.length === 0) {
      console.error('❌ 缺少默认分类数据')
      return false
    }
    
    // 检查默认支付方式
    const { data: paymentMethods, error: paymentError } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_default', true)
    
    if (paymentError) {
      console.error('❌ 无法检查默认支付方式:', paymentError.message)
      return false
    }
    
    if (!paymentMethods || paymentMethods.length === 0) {
      console.error('❌ 缺少默认支付方式数据')
      return false
    }
    
    console.log('✅ 默认数据完整')
    console.log(`   - 订阅计划: ${plans.length} 个`)
    console.log(`   - 分类: ${categories.length} 个`)
    console.log(`   - 支付方式: ${paymentMethods.length} 个`)
    return true
  } catch (error) {
    console.error('❌ 检查默认数据失败:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 开始检查Supabase配置...\n')
  
  const checks = [
    checkEnvironmentVariables,
    checkSupabaseConnection,
    checkDatabaseTables,
    checkAuthConfiguration,
    checkDefaultData
  ]
  
  let allPassed = true
  
  for (const check of checks) {
    const passed = await check()
    if (!passed) {
      allPassed = false
    }
    console.log() // 空行分隔
  }
  
  if (allPassed) {
    console.log('🎉 所有检查通过！Supabase配置正确。')
    console.log('\n下一步：')
    console.log('1. 在Supabase Dashboard中配置Google OAuth')
    console.log('2. 设置Webhook处理新用户注册')
    console.log('3. 配置邮件服务')
    console.log('4. 运行 npm run dev 启动开发服务器')
  } else {
    console.log('❌ 配置检查失败，请修复上述问题后重试。')
    console.log('\n参考文档：docs/SUPABASE_SETUP.md')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('检查脚本执行失败:', error)
  process.exit(1)
})