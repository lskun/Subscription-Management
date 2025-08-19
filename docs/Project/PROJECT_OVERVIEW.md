# 订阅管理SaaS平台 - 完整项目说明

## 项目概述

这是一个现代化的订阅管理SaaS平台，帮助用户轻松管理和跟踪各种订阅服务的费用和续费情况。项目采用前后端分离架构，支持多用户、多租户，具备完整的用户认证、权限管理、数据分析等企业级功能。

### 技术架构

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **后端**: Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- **状态管理**: Zustand
- **图表库**: Recharts
- **UI组件**: Radix UI + shadcn/ui
- **部署**: Docker + Docker Compose

## 核心功能模块

### 1. 用户认证与权限管理
- **Google OAuth登录**: 支持Google账号一键登录
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

## API接口文档

### 认证相关API

#### Supabase Auth API
- **登录**: `POST /auth/v1/token` - Google OAuth登录
- **登出**: `POST /auth/v1/logout` - 用户登出
- **刷新令牌**: `POST /auth/v1/token?grant_type=refresh_token`
- **用户信息**: `GET /auth/v1/user`

### 用户管理API

#### 用户配置
- `GET /rest/v1/user_profiles` - 获取用户配置
- `POST /rest/v1/user_profiles` - 创建用户配置
- `PATCH /rest/v1/user_profiles` - 更新用户配置
- `DELETE /rest/v1/user_profiles` - 删除用户配置

#### 用户权限
- `GET /rest/v1/user_permissions` - 获取用户权限
- `POST /rest/v1/user_permissions` - 分配权限
- `DELETE /rest/v1/user_permissions` - 撤销权限

### 订阅管理API

#### 订阅CRUD
- `GET /rest/v1/subscriptions` - 获取订阅列表
- `POST /rest/v1/subscriptions` - 创建订阅
- `PATCH /rest/v1/subscriptions` - 更新订阅
- `DELETE /rest/v1/subscriptions` - 删除订阅

#### 订阅统计
- `GET /rest/v1/rpc/get_subscription_stats` - 获取订阅统计
- `GET /rest/v1/rpc/get_upcoming_renewals` - 获取即将续费订阅
- `GET /rest/v1/rpc/get_expired_subscriptions` - 获取过期订阅

### 财务分析API

#### 费用统计
- `GET /rest/v1/rpc/get_monthly_expenses` - 月度费用统计
- `GET /rest/v1/rpc/get_yearly_expenses` - 年度费用统计
- `GET /rest/v1/rpc/get_category_breakdown` - 分类费用分析

#### 汇率管理
- `GET /rest/v1/exchange_rates` - 获取汇率数据
- `POST /rest/v1/exchange_rates` - 更新汇率
- `GET /rest/v1/rpc/convert_currency` - 货币转换

### 支付历史API

#### 支付记录
- `GET /rest/v1/payment_history` - 获取支付历史
- `POST /rest/v1/payment_history` - 创建支付记录
- `PATCH /rest/v1/payment_history` - 更新支付记录
- `DELETE /rest/v1/payment_history` - 删除支付记录

### 通知系统API

#### 邮件通知
- `POST /functions/v1/send-notification-email` - 发送通知邮件
- `POST /functions/v1/send-welcome-email` - 发送欢迎邮件

#### 实时通知
- `GET /rest/v1/notifications` - 获取通知列表
- `POST /rest/v1/notifications` - 创建通知
- `PATCH /rest/v1/notifications` - 标记通知已读

### 管理员API

#### 用户管理
- `GET /rest/v1/admin_users` - 获取管理员用户
- `POST /rest/v1/admin_users` - 创建管理员
- `PATCH /rest/v1/admin_users` - 更新管理员信息

#### 操作日志
- `GET /rest/v1/admin_operation_logs` - 获取操作日志
- `POST /rest/v1/admin_operation_logs` - 记录操作日志

### Edge Functions

#### 汇率更新
- `POST /functions/v1/update-exchange-rates` - 更新汇率数据

#### 用户初始化
- `POST /functions/v1/handle-new-user` - 处理新用户注册

## 数据库结构

### 核心表结构

#### 用户相关表
```sql
-- 用户配置表
user_profiles (
    id UUID PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    timezone TEXT,
    language TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)

-- 用户权限表
user_permissions (
    id UUID PRIMARY KEY,
    user_id UUID,
    permission_type TEXT,
    resource_id UUID,
    granted_at TIMESTAMPTZ
)

-- 用户配额表
user_quota_usage (
    id UUID PRIMARY KEY,
    user_id UUID,
    quota_type TEXT,
    used_amount INTEGER,
    total_limit INTEGER,
    reset_date DATE
)
```

#### 订阅相关表
```sql
-- 订阅表
subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID,
    name TEXT,
    plan TEXT,
    billing_cycle TEXT,
    amount DECIMAL,
    currency TEXT,
    next_billing_date DATE,
    status TEXT,
    category_id UUID,
    payment_method_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)

-- 分类表
categories (
    id UUID PRIMARY KEY,
    user_id UUID,
    name TEXT,
    color TEXT,
    icon TEXT,
    is_default BOOLEAN
)

-- 支付方式表
payment_methods (
    id UUID PRIMARY KEY,
    user_id UUID,
    name TEXT,
    type TEXT,
    is_default BOOLEAN
)
```

#### 财务相关表
```sql
-- 支付历史表
payment_history (
    id UUID PRIMARY KEY,
    subscription_id UUID,
    user_id UUID,
    amount DECIMAL,
    currency TEXT,
    payment_date DATE,
    status TEXT,
    billing_period_start DATE,
    billing_period_end DATE
)

-- 汇率表
exchange_rates (
    id UUID PRIMARY KEY,
    from_currency TEXT,
    to_currency TEXT,
    rate DECIMAL,
    updated_at TIMESTAMPTZ
)

-- 月度分类汇总表
monthly_category_summary (
    id UUID PRIMARY KEY,
    user_id UUID,
    year INTEGER,
    month INTEGER,
    category_id UUID,
    total_amount DECIMAL,
    currency TEXT
)
```

#### 通知相关表
```sql
-- 通知表
notifications (
    id UUID PRIMARY KEY,
    user_id UUID,
    type TEXT,
    title TEXT,
    message TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMPTZ
)

-- 邮件日志表
email_logs (
    id UUID PRIMARY KEY,
    user_id UUID,
    email_type TEXT,
    recipient_email TEXT,
    subject TEXT,
    status TEXT,
    sent_at TIMESTAMPTZ
)

-- 邮件偏好表
email_preferences (
    id UUID PRIMARY KEY,
    user_id UUID,
    renewal_reminders BOOLEAN,
    payment_confirmations BOOLEAN,
    weekly_summaries BOOLEAN,
    marketing_emails BOOLEAN
)
```

#### 管理员相关表
```sql
-- 管理员角色表
admin_roles (
    id UUID PRIMARY KEY,
    name TEXT,
    description TEXT,
    permissions JSONB,
    is_active BOOLEAN
)

-- 管理员用户表
admin_users (
    id UUID PRIMARY KEY,
    user_id UUID,
    role_id UUID,
    is_active BOOLEAN,
    created_by UUID,
    created_at TIMESTAMPTZ
)

-- 管理员操作日志表
admin_operation_logs (
    id UUID PRIMARY KEY,
    admin_user_id UUID,
    operation_type TEXT,
    target_type TEXT,
    target_id TEXT,
    operation_details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ
)
```

## 本地开发环境搭建

### 环境要求
- Node.js 20+
- npm 或 yarn
- Docker & Docker Compose (可选)
- Supabase CLI (推荐)

### 1. 克隆项目
```bash
git clone <repository-url>
cd subscription-management-saas
```

### 2. 安装依赖
```bash
# 安装前端依赖
npm install

# 如果需要运行传统后端服务
cd server
npm install
cd ..
```

### 3. 配置环境变量
```bash
# 复制环境变量模板
cp .env.development.example .env

# 编辑 .env 文件，配置以下变量：
# VITE_SUPABASE_URL=你的Supabase项目URL
# VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
```

### 4. Supabase设置

#### 方式一：使用Supabase CLI (推荐)
```bash
# 安装Supabase CLI
npm install -g supabase

# 登录Supabase
supabase login

# 初始化项目
supabase init

# 启动本地Supabase
supabase start

# 应用数据库迁移
supabase db reset
```

#### 方式二：使用云端Supabase
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 创建新项目
3. 在SQL编辑器中运行 `supabase/migrations/` 目录下的迁移文件
4. 配置认证提供商（Google OAuth）
5. 部署Edge Functions

### 5. 启动开发服务器
```bash
# 启动前端开发服务器
npm run dev

# 访问应用
# 前端: http://localhost:5173
# Supabase Studio: http://localhost:54323 (如果使用本地Supabase)
```

### 6. 运行测试
```bash
# 运行单元测试
npm run test

# 运行E2E测试
npm run test:e2e

# 运行测试覆盖率
npm run test:coverage
```

## 生产环境部署

### Docker部署 (推荐)

#### 1. 准备环境变量
```bash
# 创建生产环境配置
cp .env.production.example .env.production

# 编辑配置文件，设置生产环境变量
```

#### 2. 构建和启动
```bash
# 构建并启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 3. 健康检查
```bash
# 检查服务健康状态
curl http://localhost:3001/api/health
```

### 手动部署

#### 1. 构建前端
```bash
npm run build
```

#### 2. 配置Web服务器
```nginx
# Nginx配置示例
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 3. 启动后端服务
```bash
cd server
npm start
```

## 开发指南

### 代码结构
```
src/
├── components/          # React组件
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

### 开发规范
- 使用TypeScript进行类型安全开发
- 遵循ESLint和Prettier代码规范
- 组件使用函数式组件和Hooks
- 使用shadcn/ui组件库保持UI一致性
- API调用统一使用service层封装
- 状态管理使用Zustand
- 测试覆盖率保持在80%以上

### 常用命令
```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run preview          # 预览生产构建

# 测试
npm run test             # 运行单元测试
npm run test:e2e         # 运行E2E测试
npm run test:ui          # 运行测试UI

# 代码质量
npm run lint             # 代码检查
npm run type-check       # 类型检查

# Supabase
supabase start           # 启动本地Supabase
supabase stop            # 停止本地Supabase
supabase db reset        # 重置数据库
supabase functions serve # 启动Edge Functions
```

## 故障排除

### 常见问题

#### 1. Supabase连接问题
```bash
# 检查环境变量
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# 检查Supabase服务状态
supabase status
```

#### 2. 认证问题
```bash
# 检查Google OAuth配置
# 确保在Supabase Dashboard中正确配置了Google OAuth
# 检查回调URL设置
```

#### 3. 数据库迁移问题
```bash
# 重置数据库
supabase db reset

# 手动应用迁移
supabase db push
```

#### 4. Edge Functions问题
```bash
# 部署Edge Functions
supabase functions deploy

# 查看函数日志
supabase functions logs
```

### 性能优化

#### 1. 前端优化
- 使用React.memo优化组件渲染
- 实现虚拟滚动处理大量数据
- 使用懒加载减少初始加载时间
- 优化图片和静态资源

#### 2. 数据库优化
- 合理使用数据库索引
- 优化查询语句
- 使用RLS策略保证安全性
- 定期清理过期数据

#### 3. API优化
- 实现请求缓存
- 使用分页减少数据传输
- 优化数据库查询
- 使用CDN加速静态资源

## 贡献指南

### 提交代码
1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

### 代码审查
- 确保代码通过所有测试
- 遵循项目代码规范
- 添加必要的文档和注释
- 更新相关的API文档

## 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交Issue
- 发送邮件
- 参与讨论

---

**注意**: 本文档会随着项目的发展持续更新。建议定期查看最新版本。