import type { User } from '@supabase/supabase-js'

/**
 * 获取用户显示名称
 * @param user 用户对象
 * @returns 用户显示名称
 */
export function getUserDisplayName(user: User | null): string {
  if (!user) {
    return '用户'
  }
  
  if (user.user_metadata?.display_name) {
    return user.user_metadata.display_name
  }
  
  if (user.user_metadata?.full_name) {
    return user.user_metadata.full_name
  }
  
  if (user.email) {
    return user.email.split('@')[0]
  }
  
  return '用户'
}

/**
 * 获取用户头像备用文本（首字母）
 * @param user 用户对象
 * @returns 头像备用文本
 */
export function getUserAvatarFallback(user: User | null): string {
  if (!user) {
    return 'U'
  }
  
  const displayName = getUserDisplayName(user)
  
  // 如果是中文名，取最后一个字符
  if (/[\u4e00-\u9fa5]/.test(displayName)) {
    return displayName.charAt(displayName.length - 1).toUpperCase()
  }
  
  // 如果是英文名，取第一个字符
  return displayName.charAt(0).toUpperCase()
}