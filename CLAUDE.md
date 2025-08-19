# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 常用开发命令

### 核心开发
```bash
# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint

# 类型检查
tsc -b
```

### 测试
```bash
# 单元测试
npm run test

# E2E测试
npm run test:e2e
```

### 数据库 & Supabase
- 数据库schema请参考`000_database_schema.sql`文件
- 数据库函数、supabase edge function的定义、功能验证、数据查询请使用supabase mcp

## 项目架构

### 技术栈
- **前端**: React 18 + TypeScript + Vite
- **UI框架**: Tailwind CSS + shadcn/ui
- **状态管理**: Zustand
- **路由**: React Router v6
- **后端**: Supabase (PostgreSQL + Auth + Edge Functions)
- **测试**: Vitest (单元) + Playwright (E2E)

### 核心系统架构

订阅管理SaaS平台，多租户架构：

1. **认证层**: Google OAuth + Supabase Auth
2. **授权**: RLS策略实现数据隔离
3. **管理系统**: 独立的管理员认证和权限管理
4. **数据层**: PostgreSQL，包含订阅、支付、分类等完整模式
5. **Edge Functions**: 基于Deno的supabase edge function
6. **实时功能**: Supabase Realtime用于通知和数据同步

### 代码结构
```
src/
├── components/         # React组件
│   ├── ui/             # 基础UI组件
│   ├── auth/           # 认证相关组件
│   ├── subscription/   # 订阅管理组件
│   ├── dashboard/      # 仪表板组件
│   ├── charts/         # 图表组件
│   ├── admin/          # 管理员组件
│   └── notifications/  # 通知组件
├── pages/              # 页面组件
├── services/           # API服务层
├── hooks/              # 自定义Hooks
├── contexts/           # React Context
├── store/              # 状态管理
├── utils/              # 工具函数
├── types/              # TypeScript类型定义
└── lib/                # 第三方库配置

supabase/
├── migrations/         # 数据库schema迁移文件
└── functions/          # Edge Functions

```

## 核心功能模块说明

### 1. 用户认证与权限管理
- **Google OAuth登录**: 支持Google账号一键登录、自定义邮箱登录
- **会话管理**: 自动会话超时、刷新令牌、会话状态监控
- **权限控制**: 基于角色的权限管理(RBAC)
- **用户配置**: 个人资料、偏好设置、头像管理

### 2. 订阅管理
- **订阅CRUD**: 创建、查看、编辑、删除订阅
- **智能续费**: 自动/手动续费处理
- **状态管理**: 活跃、暂停、取消状态跟踪
- **分类管理**: 自定义订阅分类
- **支付方式**: 多种支付方式支持
- **批量操作**: 批量导入、导出、处理

### 3. 财务分析
- **费用统计**: 月度、季度、年度费用分析
- **趋势图表**: 支出趋势、分类占比分析
- **汇率支持**: 7种主要货币实时汇率转换
- **报表生成**: 详细的财务报表和数据导出

### 4. 支付历史
- **支付记录**: 完整的支付历史追踪
- **账单管理**: 账单生成、状态跟踪
- **退款处理**: 退款记录和状态管理
- **统计分析**: 支付成功率、失败分析

### 5. 数据管理
- **数据导入**: CSV、JSON格式数据导入
- **数据导出**: 多格式数据导出
- **数据备份**: 自动数据备份和恢复
- **数据同步**: 实时数据同步

### 6. 通知系统
- **邮件通知**: 续费提醒、账单通知
- **实时通知**: 浏览器内实时通知
- **通知偏好**: 个性化通知设置
- **通知历史**: 通知记录和状态跟踪

### 7. 管理员系统
- **用户管理**: 用户账号管理、权限分配
- **系统监控**: 系统状态监控、性能分析
- **操作日志**: 详细的操作审计日志
- **权限管理**: 细粒度权限控制

### 8. 系统设置
- **主题切换**: 明暗主题、系统主题
- **多语言**: 中英文界面支持
- **货币设置**: 基础货币和显示偏好
- **系统配置**: 各种系统参数配置

### 关键模块的代码文件说明

#### 状态管理 (Zustand)
- `subscriptionStore.ts`: 主要订阅状态，支持乐观更新
- `settingsStore.ts`: 用户偏好和配置

#### 服务层 (`src/services`目录下)
- `supabaseSubscriptionService.ts`: 核心订阅CRUD操作
- `dashboardAnalyticsService.ts`: 仪表板数据聚合
- `authService.ts`: 认证和会话管理
- `adminAuthService.ts`: 管理员专用认证

#### Edge Functions (Deno)
位于 `supabase/functions/`:
- `dashboard-analytics/`: 聚合仪表板数据
- `database-metrics/`: 数据库性能指标
- `expense-reports/`: 复杂费用报告计算
- `subscriptions-management/`: 订阅操作相关功能
- `auto-renew-subscriptions/`: 自动续费处理
- `handle-new-user/`: 新用户注册处理，包含初始化用户配置、默认订阅分类创建、欢迎邮件发送等功能
- `update-exchange-rates`: 汇率更新

### 数据库模式
数据库schema请参考`000_database_schema.sql`文件

### 组件组织

#### 布局组件
- `MainLayout.tsx`: 主应用包装器，包含导航
- `ProtectedRoute.tsx`: 路由认证守卫

#### 功能组件
- `components/subscription/`: 订阅管理UI
- `components/charts/`: 数据可视化组件
- `components/admin/`: 管理面板组件
- `components/auth/`: 认证和会话组件

### 状态管理模式

#### 乐观更新
应用广泛使用乐观更新：
1. 用户操作时立即更新UI
2. API错误时回滚
3. 与服务器状态后台同步

#### 缓存策略
- Zustand持久化中间件用于客户端缓存
- 变更时缓存失效
- 通过Supabase订阅实现实时更新

### 认证流程

#### 用户认证
1. 通过Supabase Auth的Google OAuth以及自定义邮箱登录认证
2. 会话监控，自动刷新
3. 超时警告和自动登出

#### 管理员认证
1. 独立的管理员登录系统
2. 基于角色的权限(RBAC)
3. 会话跟踪和审计日志

### 测试策略

#### 单元测试 (Vitest)
- 专注于业务逻辑和工具函数
- 模拟Supabase服务以实现隔离
- 位于 `src/lib/__tests__/`

#### E2E测试 (Playwright)
- 完整用户工作流测试
- 数据库状态验证
- 位于 `tests/e2e/`

#### 测试用户账户
E2E测试需要认证时，使用以下测试账户：
- **邮箱**: `191682304@qq.com`
- **密码**: `123456`
- **重要**: E2E测试必须使用此测试账户登录，不要跳过认证步骤

### 开发工作流

实现新功能时：
1. 在 `specs/` 目录创建需求，遵循EARS格式
2. 设计技术方案和架构文档
3. 分解为具有明确验收标准的任务
4. 实现并编写相应测试
5. 通过lint和类型检查验证

### 关键约定

#### 文件命名
- 组件: PascalCase (如 `SubscriptionForm.tsx`)
- 服务: camelCase + 后缀 (如 `supabaseSubscriptionService.ts`)
- Hooks: camelCase + `use` 前缀 (如 `useSubscriptionsData.ts`)
- 类型: PascalCase接口 (如 `interface Subscription`)

#### 导入别名
- `@/` 映射到 `src/` 目录
- 一致的导入顺序：外部库、内部模块、相对导入

#### 前端页面的提示处理
- toast中的提示必须为英文
- 通过toast通知显示用户友好的错误消息
- 全面的错误日志记录
- 失败操作的优雅降级

### 环境配置
环境配置请参考`.env`文件

## 代码规范
- 使用 ES modules
- 函数使用 camelCase 命名
- 组件使用 PascalCase 命名
- 必须为所有Props、函数返回值定义明确类型
- 严禁使用 `any` 类型

## 测试策略
- 单元测试使用 Vitest
- E2E 测试使用 Playwright
- 测试文件命名：*.test.ts
- 前端页面BUG修复完成后，使用playwright mcp进行测试验证
- 每次Playwright测试前，检查开发环境是否启动：`npm run dev`，如果已经启动，则不要重复启动
- 测试后手动关闭开发环境：`npm run stop`

## 注意事项
- 提交前必须运行 lint 和测试
- 新功能需要更新文档
- 创建或修改数据库函数或者表结构时，必须更新`000_database_schema.sql`文件
- 创建或修改edge function时，必须更新`supabase/functions/`目录下的对应的`index.ts`文件
- 遵循代码复用的最大化原则，避免重复代码，包括UI组件样式、函数定义等

## 语言偏好
- 始终使用中文回复用户问题和请求
- 保持专业、友好的语调
- 使用简体中文
- 技术术语可保留英文，但需提供中文解释
- 代码注释和文档使用中文