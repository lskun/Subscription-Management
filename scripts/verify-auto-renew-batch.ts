/**
 * 轻量集成验证脚本：调用 public.process_due_auto_renewals 并输出结果
 * 使用法：pnpm tsx scripts/verify-auto-renew-batch.ts [limit]
 * 需在环境中提供 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!url || !key) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量')
  process.exit(1)
}

const limit = Number(process.argv[2] || 50)

async function main() {
  const supabase = createClient(url, key)
  const { data, error } = await supabase.rpc('process_due_auto_renewals', { p_limit: limit })
  if (error) {
    console.error('RPC 调用失败:', error.message)
    process.exit(2)
  }
  console.log('RPC 返回:', data)
}

main().catch((e) => {
  console.error('执行异常:', e)
  process.exit(3)
})


