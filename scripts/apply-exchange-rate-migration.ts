#!/usr/bin/env tsx

/**
 * 手动应用汇率系统增强迁移
 */

import { supabase } from '../src/lib/supabase'
import { readFileSync } from 'fs'
import { join } from 'path'
import { logger } from '../src/utils/logger'

async function applyExchangeRateMigration() {
  console.log('🚀 开始应用汇率系统增强迁移...\n')

  try {
    // 读取迁移文件
    const migrationPath = join(__dirname, '../supabase/migrations/011_enhance_exchange_rates.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    console.log('📄 读取迁移文件: 011_enhance_exchange_rates.sql')
    console.log(`📏 迁移文件大小: ${migrationSQL.length} 字符\n`)

    // 分割SQL语句（按分号分割，但要处理函数定义中的分号）
    const statements = migrationSQL
      .split(/;\s*(?=\n|$)/)
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`🔧 准备执行 ${statements.length} 个SQL语句\n`)

    let successCount = 0
    let errorCount = 0

    // 逐个执行SQL语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      // 跳过注释行
      if (statement.startsWith('--') || statement.trim() === '') {
        continue
      }

      try {
        console.log(`⚡ 执行语句 ${i + 1}/${statements.length}:`)
        
        // 显示语句的前50个字符
        const preview = statement.substring(0, 50).replace(/\s+/g, ' ')
        console.log(`   ${preview}${statement.length > 50 ? '...' : ''}`)

        const { error } = await supabase.rpc('exec_sql', { sql: statement })

        if (error) {
          // 某些错误可能是可以忽略的（如表已存在等）
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('duplicate key')) {
            console.log(`   ⚠️  警告: ${error.message}`)
          } else {
            throw error
          }
        }

        console.log('   ✅ 成功')
        successCount++

      } catch (error: any) {
        console.log(`   ❌ 失败: ${error.message}`)
        errorCount++
        
        // 对于某些非关键错误，继续执行
        if (!error.message.includes('permission denied') && 
            !error.message.includes('syntax error')) {
          continue
        } else {
          throw error
        }
      }
    }

    console.log(`\n📊 迁移执行结果:`)
    console.log(`   ✅ 成功: ${successCount} 个语句`)
    console.log(`   ❌ 失败: ${errorCount} 个语句`)

    if (errorCount === 0) {
      console.log('\n🎉 汇率系统增强迁移完成!')
    } else {
      console.log('\n⚠️  迁移完成，但有部分语句执行失败')
    }

    // 验证迁移结果
    console.log('\n🔍 验证迁移结果...')
    
    try {
      // 检查新表是否创建成功
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['exchange_rate_history', 'exchange_rate_update_logs'])

      if (tablesError) {
        console.log('   ⚠️  无法验证表创建结果')
      } else {
        console.log(`   ✅ 新表创建: ${tables?.length || 0}/2`)
        tables?.forEach(table => {
          console.log(`      - ${table.table_name}`)
        })
      }

      // 检查函数是否创建成功
      const { data: functions, error: functionsError } = await supabase
        .rpc('get_exchange_rate_stats')

      if (functionsError) {
        console.log('   ⚠️  统计函数可能未正确创建')
      } else {
        console.log('   ✅ 统计函数创建成功')
      }

    } catch (error) {
      console.log('   ⚠️  验证过程中出现错误，但迁移可能已成功')
    }

  } catch (error: any) {
    console.error('\n❌ 迁移失败:', error.message)
    logger.error('Exchange rate migration failed:', error)
    process.exit(1)
  }
}

// 运行迁移
if (require.main === module) {
  applyExchangeRateMigration()
}

export { applyExchangeRateMigration }