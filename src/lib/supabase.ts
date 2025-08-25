import { createClient } from '@supabase/supabase-js'

// Supabase配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const isDebugMode = import.meta.env.VITE_SUPABASE_DEBUG === 'true'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// 创建Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: isDebugMode, // 从环境变量获取调试模式设置
    // 确保OAuth回调能被正确处理
    storageKey: 'sb-auth-token',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// 导出类型定义
export type { User, Session, AuthError } from '@supabase/supabase-js'