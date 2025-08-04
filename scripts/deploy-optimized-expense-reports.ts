#!/usr/bin/env tsx

/**
 * 部署优化后的费用报告 Edge Function
 * 这个脚本将部署集成了新优化逻辑的 expense-reports Edge Function
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const FUNCTION_NAME = 'expense-reports';
const FUNCTION_PATH = path.join(process.cwd(), 'supabase', 'functions', FUNCTION_NAME);

/**
 * 检查必要的文件是否存在
 */
function checkPrerequisites(): boolean {
  console.log('🔍 检查部署前提条件...');
  
  // 检查 Edge Function 文件是否存在
  const indexPath = path.join(FUNCTION_PATH, 'index.ts');
  if (!existsSync(indexPath)) {
    console.error(`❌ Edge Function 文件不存在: ${indexPath}`);
    return false;
  }
  
  // 检查 Supabase CLI 是否可用
  try {
    execSync('supabase --version', { stdio: 'pipe' });
    console.log('✅ Supabase CLI 可用');
  } catch (error) {
    console.error('❌ Supabase CLI 不可用，请先安装 Supabase CLI');
    return false;
  }
  
  // 检查是否已登录 Supabase
  try {
    execSync('supabase projects list', { stdio: 'pipe' });
    console.log('✅ Supabase 已登录');
  } catch (error) {
    console.error('❌ 未登录 Supabase，请先运行 supabase login');
    return false;
  }
  
  return true;
}

/**
 * 部署 Edge Function
 */
function deployFunction(): boolean {
  try {
    console.log(`🚀 开始部署 ${FUNCTION_NAME} Edge Function...`);
    
    // 部署 Edge Function
    const deployCommand = `supabase functions deploy ${FUNCTION_NAME}`;
    console.log(`执行命令: ${deployCommand}`);
    
    execSync(deployCommand, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log(`✅ ${FUNCTION_NAME} Edge Function 部署成功！`);
    return true;
  } catch (error) {
    console.error(`❌ 部署 ${FUNCTION_NAME} Edge Function 失败:`, error);
    return false;
  }
}

/**
 * 验证部署结果
 */
function verifyDeployment(): boolean {
  try {
    console.log('🔍 验证部署结果...');
    
    // 列出所有 Edge Functions
    const listCommand = 'supabase functions list';
    console.log(`执行命令: ${listCommand}`);
    
    const output = execSync(listCommand, { 
      encoding: 'utf8',
      cwd: process.cwd()
    });
    
    if (output.includes(FUNCTION_NAME)) {
      console.log(`✅ ${FUNCTION_NAME} Edge Function 已成功部署并可用`);
      return true;
    } else {
      console.error(`❌ ${FUNCTION_NAME} Edge Function 未在函数列表中找到`);
      return false;
    }
  } catch (error) {
    console.error('❌ 验证部署结果失败:', error);
    return false;
  }
}

/**
 * 显示部署后的使用说明
 */
function showUsageInstructions(): void {
  console.log('\n📋 部署完成！使用说明:');
  console.log('');
  console.log('1. Edge Function URL:');
  console.log(`   https://your-project-id.supabase.co/functions/v1/${FUNCTION_NAME}`);
  console.log('');
  console.log('2. 测试 API 调用:');
  console.log('   curl -X POST \\');
  console.log(`     https://your-project-id.supabase.co/functions/v1/${FUNCTION_NAME} \\`);
  console.log('     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"targetCurrency": "CNY", "includeExpenseInfo": true}\'');
  console.log('');
  console.log('3. 优化特性:');
  console.log('   ✅ 单次查询获取所有支付记录（减少数据库查询次数）');
  console.log('   ✅ 基于分组数据计算支付次数（避免重复查询）');
  console.log('   ✅ 并行获取汇率、支付记录和订阅数据');
  console.log('   ✅ 保持与现有 API 响应格式的完全兼容性');
  console.log('');
  console.log('4. 性能提升:');
  console.log('   📈 数据库查询次数从 N 次减少到 3 次');
  console.log('   📈 响应时间预计提升 60-80%');
  console.log('   📈 减少数据库负载和网络延迟');
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('🎯 开始部署优化后的费用报告 Edge Function');
  console.log('');
  
  try {
    // 检查前提条件
    if (!checkPrerequisites()) {
      process.exit(1);
    }
    
    console.log('');
    
    // 部署 Edge Function
    if (!deployFunction()) {
      process.exit(1);
    }
    
    console.log('');
    
    // 验证部署结果
    if (!verifyDeployment()) {
      process.exit(1);
    }
    
    // 显示使用说明
    showUsageInstructions();
    
    console.log('');
    console.log('🎉 优化后的费用报告 Edge Function 部署完成！');
    
  } catch (error) {
    console.error('❌ 部署过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 部署脚本执行失败:', error);
    process.exit(1);
  });
}

export { main as deployOptimizedExpenseReports };