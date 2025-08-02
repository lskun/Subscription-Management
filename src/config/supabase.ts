/**
 * Supabase 配置
 */
export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  
  // 验证配置是否完整
  validate(): void {
    if (!this.url || !this.anonKey) {
      throw new Error('Supabase URL 或 API Key 未配置。请检查环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
    }
  },
  
  // 获取 Edge Functions 的基础 URL
  getFunctionsUrl(): string {
    this.validate()
    return `${this.url}/functions/v1`
  },
  
  // 获取认证头
  getAuthHeaders(): Record<string, string> {
    this.validate()
    return {
      'Authorization': `Bearer ${this.anonKey}`,
      'Content-Type': 'application/json'
    }
  }
}