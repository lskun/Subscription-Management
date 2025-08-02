import React from 'react'
import { SessionManager } from './SessionManager'
import { SessionTimeoutWarning } from './SessionTimeoutWarning'
import { SessionTimeoutHandler } from './SessionTimeoutHandler'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'

/**
 * 会话管理功能演示组件
 * 展示完整的会话管理功能，包括：
 * - 会话状态管理
 * - 自动token刷新
 * - 会话过期处理
 * - 安全登出
 * - 登录失败锁定
 */
export function SessionDemo() {
  const { user, isSessionValid } = useAuth()

  if (!user || !isSessionValid) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            请先登录以查看会话管理功能演示
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 功能概述 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            会话管理功能演示
            <Badge variant="outline">任务 3.4</Badge>
          </CardTitle>
          <CardDescription>
            展示完整的用户会话管理功能实现
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">✅ 已实现功能</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 用户会话状态管理</li>
                <li>• 自动token刷新机制</li>
                <li>• 会话过期和重新认证</li>
                <li>• 安全的登出功能</li>
                <li>• 登录失败锁定保护</li>
                <li>• 多标签页会话同步</li>
                <li>• 用户活动监控</li>
                <li>• 会话健康检查</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">🔧 技术特性</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 基于Supabase Auth</li>
                <li>• JWT token自动刷新</li>
                <li>• 30分钟无活动超时</li>
                <li>• 5分钟提前刷新机制</li>
                <li>• 3次失败锁定15分钟</li>
                <li>• localStorage状态持久化</li>
                <li>• 实时会话监控</li>
                <li>• 错误恢复机制</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 会话管理器 */}
      <SessionManager 
        showHealthCheck={true}
        showDetailedInfo={true}
        autoRefresh={false}
      />

      {/* 会话超时警告 */}
      <SessionTimeoutWarning 
        warningThreshold={5 * 60 * 1000} // 5分钟
        autoRefreshThreshold={2 * 60 * 1000} // 2分钟
        enableAutoRefresh={true}
      />

      {/* 会话超时处理器（不可见） */}
      <SessionTimeoutHandler 
        redirectPath="/login"
        showToast={true}
      />
    </div>
  )
}