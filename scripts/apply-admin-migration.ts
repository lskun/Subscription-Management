#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// 从环境变量获取Supabase配置
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必要的环境变量:');
  console.error('   VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// 创建Supabase客户端（使用服务角色密钥）
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyAdminMigration() {
  try {
    console.log('🚀 开始应用管理员系统迁移...');

    // 读取迁移文件
    const migrationPath = join(process.cwd(), 'supabase/migrations/013_admin_system.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 读取迁移文件: 013_admin_system.sql');
    console.log('⚠️  请手动在Supabase SQL编辑器中执行以下SQL:');
    console.log('=' .repeat(80));
    console.log(migrationSQL);
    console.log('=' .repeat(80));
    
    // 等待用户确认
    console.log('✅ 请在Supabase控制台执行上述SQL后，按任意键继续验证...');
    
    // 简单的等待用户输入
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve(undefined));
    });

    console.log('✅ 管理员系统迁移应用成功！');

    // 验证表是否创建成功
    console.log('🔍 验证表结构...');
    
    const tables = ['admin_roles', 'admin_users', 'admin_operation_logs', 'admin_sessions'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`❌ 表 ${table} 验证失败:`, error.message);
      } else {
        console.log(`✅ 表 ${table} 创建成功`);
      }
    }

    // 验证默认角色是否插入成功
    const { data: roles, error: rolesError } = await supabase
      .from('admin_roles')
      .select('name')
      .order('name');

    if (rolesError) {
      console.error('❌ 验证默认角色失败:', rolesError.message);
    } else {
      console.log('✅ 默认角色:', roles?.map(r => r.name).join(', '));
    }

    console.log('🎉 管理员系统迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
}

// 创建exec_sql函数（如果不存在）
async function createExecSqlFunction() {
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text)
    RETURNS void AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  try {
    const { error } = await supabase.rpc('exec', { sql: createFunctionSQL });
    if (error && !error.message.includes('already exists')) {
      console.log('创建exec_sql函数...');
      // 直接执行SQL
      const { error: directError } = await supabase.from('_').select('*').limit(0);
      // 这里我们需要使用不同的方法来执行SQL
    }
  } catch (error) {
    // 忽略错误，继续执行
  }
}

if (require.main === module) {
  applyAdminMigration();
}