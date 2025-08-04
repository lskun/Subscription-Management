// 邮件日志查看组件
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { useToast } from '../../hooks/use-toast'
import { emailNotificationService, EmailLog, EmailStatistics } from '../../services/emailNotificationService'
import { useAuth } from '../../contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

// 邮件状态配置
const STATUS_CONFIG = {
  pending: { label: '待发送', color: 'yellow', icon: '⏳' },
  sent: { label: '已发送', color: 'blue', icon: '📤' },
  failed: { label: '发送失败', color: 'red', icon: '❌' },
  delivered: { label: '已送达', color: 'green', icon: '✅' },
  bounced: { label: '退回', color: 'orange', icon: '↩️' },
  complained: { label: '投诉', color: 'purple', icon: '🚫' }
}

// 邮件类型配置
const EMAIL_TYPE_CONFIG = {
  welcome: { label: '欢迎邮件', icon: '👋' },
  subscription_expiry: { label: '订阅到期提醒', icon: '⏰' },
  payment_failed: { label: '支付失败通知', icon: '❌' },
  payment_success: { label: '支付成功确认', icon: '✅' },
  quota_warning: { label: '配额警告', icon: '⚠️' },
  security_alert: { label: '安全警告', icon: '🔒' },
  system_update: { label: '系统更新通知', icon: '🚀' },
  password_reset: { label: '密码重置', icon: '🔑' }
}

interface EmailLogsViewerProps {
  className?: string
}

export function EmailLogsViewer({ className }: EmailLogsViewerProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [statistics, setStatistics] = useState<EmailStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  
  const pageSize = 20

  // 加载邮件日志
  useEffect(() => {
    if (user?.id) {
      loadEmailLogs(true)
      loadEmailStatistics()
    }
  }, [user?.id])

  const loadEmailLogs = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true)
        setPage(0)
      } else {
        setLoadingMore(true)
      }

      const currentPage = reset ? 0 : page
      const { data, count } = await emailNotificationService.getUserEmailLogs(
        user!.id,
        pageSize,
        currentPage * pageSize
      )

      if (reset) {
        setLogs(data)
      } else {
        setLogs(prev => [...prev, ...data])
      }

      setHasMore(data.length === pageSize && (currentPage + 1) * pageSize < count)
      setPage(currentPage + 1)
    } catch (error) {
      console.error('加载邮件日志失败:', error)
      toast({
        title: '加载失败',
        description: '无法加载邮件日志，请刷新页面重试',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadEmailStatistics = async () => {
    try {
      const stats = await emailNotificationService.getUserEmailStatistics(user!.id)
      setStatistics(stats)
    } catch (error) {
      console.error('加载邮件统计失败:', error)
    }
  }

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadEmailLogs(false)
    }
  }

  const refresh = () => {
    loadEmailLogs(true)
    loadEmailStatistics()
  }

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: zhCN
      })
    } catch {
      return '未知时间'
    }
  }

  const getStatusBadge = (status: EmailLog['status']) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
    return (
      <Badge 
        variant={status === 'delivered' ? 'default' : 'secondary'}
        className={`text-${config.color}-600 border-${config.color}-200`}
      >
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </Badge>
    )
  }

  const getEmailTypeBadge = (emailType: EmailLog['email_type']) => {
    const config = EMAIL_TYPE_CONFIG[emailType]
    if (!config) return null
    
    return (
      <Badge variant="outline" className="text-xs">
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>邮件发送记录</CardTitle>
          <CardDescription>正在加载邮件日志...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded w-48 animate-pulse" />
                </div>
                <div className="h-6 bg-gray-200 rounded w-16 animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              📧 邮件发送记录
            </CardTitle>
            <CardDescription>
              查看您的邮件发送历史和状态
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 邮件统计 */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{statistics.total_emails}</div>
              <div className="text-sm text-blue-600">总邮件数</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{statistics.sent_emails}</div>
              <div className="text-sm text-green-600">已发送</div>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">{statistics.delivered_emails}</div>
              <div className="text-sm text-emerald-600">已送达</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{statistics.failed_emails}</div>
              <div className="text-sm text-red-600">发送失败</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{statistics.bounced_emails}</div>
              <div className="text-sm text-orange-600">退回</div>
            </div>
          </div>
        )}

        <Separator />

        {/* 邮件日志列表 */}
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📭</div>
              <p>暂无邮件发送记录</p>
            </div>
          ) : (
            <>
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getEmailTypeBadge(log.email_type)}
                        {getStatusBadge(log.status)}
                        <span className="text-sm text-gray-500">
                          发送至: {log.email_address}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        {formatDate(log.sent_at)}
                      </div>
                      
                      {log.error_message && (
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded border-l-4 border-red-200">
                          <strong>错误信息:</strong> {log.error_message}
                        </div>
                      )}
                      
                      {log.external_email_id && (
                        <div className="text-xs text-gray-400">
                          邮件ID: {log.external_email_id}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {hasMore && (
                <div className="text-center pt-4">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? '加载中...' : '加载更多'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default EmailLogsViewer