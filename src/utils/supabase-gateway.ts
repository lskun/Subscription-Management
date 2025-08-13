import { supabase } from '@/lib/supabase'

type InvokeOptions<TBody = any> = {
  headers?: Record<string, string>
  body?: TBody
}

function isUnauthorized(err: any): boolean {
  if (!err) return false
  const msg = String(err?.message || err?.error_description || err?.error || '')
  const code = String((err as any)?.code || (err as any)?.status || '')
  return (
    code === '401' ||
    (typeof (err as any)?.status === 'number' && (err as any)?.status === 401) ||
    /401|unauthorized|jwt|invalid token|expired|refresh token/i.test(msg)
  )
}

function isForbidden(err: any): boolean {
  if (!err) return false
  const msg = String(err?.message || err?.error_description || err?.error || '')
  const code = String((err as any)?.code || (err as any)?.status || '')
  return (
    code === '403' ||
    (typeof (err as any)?.status === 'number' && (err as any)?.status === 403) ||
    /403|forbidden|permission|denied|insufficient/i.test(msg)
  )
}

async function getAccessToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || undefined
}

function broadcastUnauthorized() {
  try {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
  } catch {}
}

export const supabaseGateway = {
  // Edge Function 调用（自动附带 JWT，401 时刷新并重试一次）
  async invokeFunction<TResp = any, TBody = any>(name: string, options: InvokeOptions<TBody> = {}): Promise<{ data: TResp; error: any | null }> {
    const doCall = async () => {
      const token = await getAccessToken()
      const baseHeaders = options.headers || {}
      const headers = token ? { ...baseHeaders, Authorization: `Bearer ${token}` } : baseHeaders
      return (await supabase.functions.invoke(name, { headers, body: options.body as any })) as any
    }

    let { data, error } = await doCall()
    if (error && (isUnauthorized(error) || isForbidden(error))) {
      await supabase.auth.refreshSession()
      const retry = await doCall()
      data = retry.data
      error = retry.error
      if (error) {
        if (isUnauthorized(error)) broadcastUnauthorized()
        if (isForbidden(error)) {
          try { window.dispatchEvent(new CustomEvent('auth:forbidden')) } catch {}
        }
      }
    }
    return { data: data as TResp, error }
  },

  // RPC 调用（401 时刷新并重试一次）
  async rpc<TResp = any>(name: string, params?: Record<string, any>): Promise<{ data: TResp; error: any | null }> {
    const doCall = async () => (await supabase.rpc(name, params as any)) as any
    let { data, error } = await doCall()
    if (error && (isUnauthorized(error) || isForbidden(error))) {
      await supabase.auth.refreshSession()
      const retry = await doCall()
      data = retry.data
      error = retry.error
      if (error) {
        if (isUnauthorized(error)) broadcastUnauthorized()
        if (isForbidden(error)) {
          try { window.dispatchEvent(new CustomEvent('auth:forbidden')) } catch {}
        }
      }
    }
    return { data: data as TResp, error }
  }
}


