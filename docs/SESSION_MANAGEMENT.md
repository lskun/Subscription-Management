# 会话管理系统文档

## 概述

会话管理系统为SaaS平台提供了完整的用户会话管理功能，包括自动token刷新、会话超时检测、用户活动跟踪和安全登出等功能。

## 核心功能

### 1. 自动Token刷新
- 在token过期前5分钟自动刷新
- 支持手动强制刷新
- 刷新失败时自动处理和用户通知

### 2. 会话超时管理
- 30分钟无活动自动超时
- 用户活动自动跟踪（鼠标、键盘、触摸等）
- 超时前显示警告对话框

### 3. 多标签页同步
- 跨标签页会话状态同步
- 一个标签页登出，其他标签页自动更新状态

### 4. 会话健康监控
- 定期检查会话健康状态
- 检测潜在问题并提供修复建议
- 支持会话管理恢复

### 5. 安全功能
- 安全的登出处理
- 会话数据清理
- 防止会话劫持

## 组件架构

### 核心服务

#### SessionService
会话管理的核心服务类，提供以下功能：
- `getCurrentSessionState()` - 获取当前会话状态
- `startSessionManagement()` - 启动会话管理
- `stopSessionManagement()` - 停止会话管理
- `validateSession()` - 验证会话有效性
- `forceRefresh()` - 强制刷新token
- `signOut()` - 安全登出
- `checkSessionHealth()` - 检查会话健康状态

#### AuthContext
认证上下文，提供会话状态和管理方法：
```typescript
const {
  user,
  session,
  isSessionValid,
  timeUntilExpiry,
  refreshSession,
  validateSession,
  signOut
} = useAuth()
```

### UI组件

#### SessionManager
完整的会话管理界面，适用于设置页面：
```tsx
<SessionManager 
  showHealthCheck={true}
  showDetailedInfo={true}
  autoRefresh={false}
/>
```

#### SessionIndicator
轻量级会话状态指示器，适用于导航栏：
```tsx
<SessionIndicator 
  showUserInfo={true}
  showRefreshButton={true}
  compact={false}
/>
```

#### SessionTimeoutWarning
会话超时警告对话框：
```tsx
<SessionTimeoutWarning 
  warningThreshold={5 * 60 * 1000}
  autoRefreshThreshold={2 * 60 * 1000}
  enableAutoRefresh={true}
/>
```

#### SessionStatus
会话状态显示组件：
```tsx
<SessionStatus showDetails={true} />
```

### Hooks

#### useSessionMonitor
会话监控Hook：
```typescript
const {
  isHealthy,
  issues,
  recommendations,
  needsAttention,
  checkHealth,
  manualRefresh
} = useSessionMonitor({
  checkInterval: 30000,
  autoRefresh: true,
  warningThreshold: 5 * 60 * 1000
})
```

#### useSessionStatus
简化的会话状态Hook：
```typescript
const {
  isLoggedIn,
  isExpiringSoon,
  timeUntilExpiry,
  user
} = useSessionStatus()
```

#### useSessionWarning
会话警告Hook：
```typescript
const {
  shouldShowWarning,
  timeUntilExpiry
} = useSessionWarning(5 * 60 * 1000)
```

## 集成指南

### 1. 基础设置

在应用根组件中包装AuthProvider：
```tsx
import { AuthProvider } from '@/contexts/AuthContext'

function App() {
  return (
    <AuthProvider>
      {/* 应用内容 */}
      <SessionTimeoutWarning />
    </AuthProvider>
  )
}
```

### 2. 导航栏集成

在导航栏中添加会话状态指示器：
```tsx
import { SessionIndicator } from '@/components/auth/SessionIndicator'

function Navbar() {
  return (
    <nav>
      {/* 其他导航内容 */}
      <SessionIndicator 
        showUserInfo={false}
        showRefreshButton={true}
        compact={true}
      />
    </nav>
  )
}
```

### 3. 设置页面集成

在设置页面中添加完整的会话管理：
```tsx
import { SessionManager } from '@/components/auth/SessionManager'

function SettingsPage() {
  return (
    <div>
      <SessionManager 
        showHealthCheck={true}
        showDetailedInfo={true}
        autoRefresh={false}
      />
    </div>
  )
}
```

### 4. 自定义监控

使用会话监控Hook实现自定义功能：
```tsx
import { useSessionMonitor } from '@/hooks/useSessionMonitor'

function MyComponent() {
  const { isHealthy, needsAttention, checkHealth } = useSessionMonitor({
    checkInterval: 30000,
    autoRefresh: true
  })

  useEffect(() => {
    if (needsAttention) {
      // 处理需要关注的会话问题
    }
  }, [needsAttention])

  return (
    <div>
      {!isHealthy && (
        <Alert>会话状态异常，请检查</Alert>
      )}
    </div>
  )
}
```

## 配置选项

### SessionService配置
```typescript
// 会话超时时间（默认30分钟）
SESSION_TIMEOUT = 30 * 60 * 1000

// Token刷新阈值（默认5分钟）
REFRESH_THRESHOLD = 5 * 60 * 1000
```

### SessionTimeoutWarning配置
```typescript
interface SessionTimeoutWarningProps {
  warningThreshold?: number // 提前警告时间（默认5分钟）
  autoRefreshThreshold?: number // 自动刷新阈值（默认2分钟）
  enableAutoRefresh?: boolean // 是否启用自动刷新（默认true）
}
```

### useSessionMonitor配置
```typescript
interface SessionMonitorOptions {
  checkInterval?: number // 检查间隔（默认30秒）
  autoRefresh?: boolean // 是否自动刷新（默认false）
  warningThreshold?: number // 警告阈值（默认5分钟）
}
```

## 事件系统

会话管理系统会触发以下自定义事件：

### sessionTimeout
会话因无活动而超时时触发：
```typescript
window.addEventListener('sessionTimeout', () => {
  // 处理会话超时
})
```

### sessionExpired
会话过期时触发：
```typescript
window.addEventListener('sessionExpired', (event: CustomEvent) => {
  const { reason } = event.detail
  // 处理会话过期，reason可能是'token_refresh_failed'等
})
```

## 最佳实践

### 1. 错误处理
始终为会话操作添加错误处理：
```typescript
try {
  const success = await refreshSession()
  if (!success) {
    // 处理刷新失败
  }
} catch (error) {
  // 处理异常
}
```

### 2. 用户体验
- 在会话即将过期时提前通知用户
- 提供手动刷新选项
- 在自动操作时显示加载状态

### 3. 安全考虑
- 敏感操作前验证会话有效性
- 定期检查会话健康状态
- 在检测到异常时及时处理

### 4. 性能优化
- 合理设置检查间隔
- 避免频繁的会话验证
- 使用防抖处理用户活动

## 故障排除

### 常见问题

#### 1. 会话频繁过期
- 检查token刷新逻辑是否正常
- 确认服务器时间同步
- 验证Supabase配置

#### 2. 多标签页同步问题
- 检查localStorage事件监听
- 确认会话数据格式一致

#### 3. 自动刷新失败
- 检查网络连接
- 验证refresh token有效性
- 查看Supabase服务状态

#### 4. 会话管理未启动
- 确认AuthProvider正确包装
- 检查会话管理启动时机
- 验证用户登录状态

### 调试工具

启用调试模式查看详细日志：
```typescript
// 在浏览器控制台中
localStorage.setItem('debug-session', 'true')
```

查看会话详细信息：
```typescript
const { getDetailedSessionInfo } = useAuth()
const info = await getDetailedSessionInfo()
console.log('会话详细信息:', info)
```

检查会话健康状态：
```typescript
const { checkSessionHealth } = useAuth()
const health = await checkSessionHealth()
console.log('会话健康状态:', health)
```

## 测试

### 单元测试
会话管理功能包含完整的单元测试：
- AuthService测试
- SessionService测试
- 组件测试

### 集成测试
测试会话管理与其他系统的集成：
- 认证流程测试
- 多标签页同步测试
- 自动刷新测试

### E2E测试
端到端测试用户会话管理流程：
- 登录到超时的完整流程
- 会话恢复测试
- 异常情况处理测试

运行测试：
```bash
npm run test
npm run test:integration
npm run test:e2e
```

## 更新日志

### v1.0.0
- 初始版本发布
- 基础会话管理功能
- 自动token刷新
- 会话超时检测

### v1.1.0
- 添加会话健康监控
- 改进多标签页同步
- 增强错误处理

### v1.2.0
- 添加会话管理UI组件
- 改进用户体验
- 增加配置选项

## 支持

如果您在使用会话管理系统时遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查浏览器控制台的错误信息
3. 验证Supabase配置和网络连接
4. 联系技术支持团队

---

*最后更新: 2024年1月*