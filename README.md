# 订阅管理SaaS平台

[English](README.md) | [简体中文](README.zh-CN.md)

一个现代化的订阅管理SaaS平台，帮助用户轻松管理和跟踪各种订阅服务的费用和续费情况。支持多用户、多租户，具备完整的用户认证、权限管理、数据分析等企业级功能。

## 📸 Interface Preview

### Dashboard - Smart Expense Overview
![Dashboard](docs/images/dashboard.png)
*Smart dashboard displaying monthly/yearly expense statistics, upcoming subscription reminders, and categorized expense analysis*

### Subscription Management - Complete Service Management
![Subscription Management](docs/images/subscriptions.png)
*Complete subscription lifecycle management with support for adding, editing, status management, and batch import*

### Payment History - Detailed Record Tracking
![Payment History](docs/images/subscriptions-payments.png)
*Complete payment history records with search support and CRUD operations for orders*

### Monthly Expenses - Trend Analysis
![Monthly Expenses](docs/images/monthly-expense.png)
*Monthly expense orders with intuitive display of spending details*

### Expense Reports - In-depth Data Analysis
![Expense Reports](docs/images/reports.png)
*Powerful expense analysis features including trend charts, category statistics, and multi-dimensional data display*

### Dark Theme - Modern Interface
![Dark Theme Reports](docs/images/reports-dark.png)
*Dark theme support*

## 🌟 核心特性

### 企业级功能
- **多用户SaaS架构** - 支持多租户、用户隔离、权限管理
- **Google OAuth认证** - 安全的第三方登录，支持会话管理
- **管理员系统** - 完整的后台管理、用户管理、操作审计
- **实时通知系统** - 邮件通知、浏览器推送、通知偏好设置

### 订阅管理
- **智能订阅管理** - 全生命周期管理，支持自动/手动续费
- **多货币支持** - 7种主要货币，实时汇率自动更新
- **费用分析报表** - 强大的数据分析和可视化图表功能
- **批量操作** - 支持CSV导入导出、批量处理

### 技术特性
- **响应式设计** - 完美适配桌面端和移动端
- **云端存储** - 基于Supabase的安全云端数据存储
- **Docker部署** - 一键部署，开箱即用
- **实时同步** - 多设备数据实时同步

## 📊 功能概览

### 已完成功能 (Task 1-10)

#### 🔐 用户认证与权限 (Task 1-2)
- ✅ **Google OAuth登录** - 安全的第三方认证
- ✅ **会话管理** - 自动超时、令牌刷新、状态监控
- ✅ **权限控制** - 基于角色的权限管理(RBAC)
- ✅ **用户配置** - 个人资料、偏好设置、头像管理

#### 📊 订阅管理核心 (Task 3-4)
- ✅ **订阅CRUD** - 完整的订阅生命周期管理
- ✅ **智能续费** - 自动/手动续费处理
- ✅ **状态管理** - 活跃、暂停、取消状态跟踪
- ✅ **分类管理** - 自定义订阅分类和支付方式

#### 💰 财务分析 (Task 5-6)
- ✅ **费用统计** - 月度、季度、年度费用分析
- ✅ **趋势图表** - 支出趋势、分类占比分析
- ✅ **汇率支持** - 7种主要货币实时汇率转换
- ✅ **支付历史** - 完整的支付记录和历史分析

#### 📈 数据管理 (Task 7-8)
- ✅ **数据导入导出** - CSV、JSON格式支持
- ✅ **汇率调度器** - 自动汇率更新服务
- ✅ **批量操作** - 批量导入、处理订阅数据

#### 🔔 通知系统 (Task 9)
- ✅ **邮件通知** - 续费提醒、账单通知
- ✅ **实时通知** - 浏览器内实时通知
- ✅ **通知偏好** - 个性化通知设置
- ✅ **通知历史** - 通知记录和状态跟踪

#### 👨‍💼 管理员系统 (Task 10)
- ✅ **用户管理** - 用户账号管理、权限分配
- ✅ **系统监控** - 系统状态监控、性能分析
- ✅ **操作日志** - 详细的操作审计日志
- ✅ **权限管理** - 细粒度权限控制

### 系统特性
- ✅ **响应式设计** - 完美适配桌面端和移动端
- ✅ **主题切换** - 明暗主题、系统主题支持
- ✅ **多语言** - 中英文界面支持
- ✅ **实时同步** - 多设备数据实时同步

## 🛠 技术栈

### 前端技术
- **框架**: React 18 + TypeScript + Vite
- **样式**: Tailwind CSS + shadcn/ui
- **状态管理**: Zustand
- **路由**: React Router
- **图表**: Recharts
- **UI组件**: Radix UI + shadcn/ui

### 后端技术
- **BaaS平台**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **实时功能**: Supabase Realtime
- **认证**: Supabase Auth (Google OAuth)
- **数据库**: PostgreSQL (云端) + Row Level Security
- **Edge Functions**: Deno + TypeScript

### 开发工具
- **构建工具**: Vite
- **测试框架**: Vitest + Playwright
- **代码规范**: ESLint + Prettier
- **类型检查**: TypeScript
- **容器化**: Docker + Docker Compose

## 🚀 快速开始

### 环境要求
- Node.js 20+
- Git
- Supabase账号 (推荐) 或 Docker

### 方式一：使用Supabase云服务 (推荐)

1. **克隆项目**
```bash
git clone <repository-url>
cd subscription-management-saas
npm install
```

2. **配置Supabase**
```bash
# 复制环境变量模板
cp .env.development.example .env

# 编辑 .env 文件，配置Supabase连接
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. **启动应用**
```bash
npm run dev
```

4. **访问应用**
- 前端界面: http://localhost:5173

### 方式二：本地Supabase开发

1. **安装Supabase CLI**
```bash
npm install -g supabase
```

2. **启动本地Supabase**
```bash
supabase start
supabase db reset
```

3. **启动前端**
```bash
npm run dev
```

### 方式三：Docker部署

1. **配置环境变量**
```bash
cp .env.production.example .env
# 编辑 .env 文件设置必要配置
```

2. **启动服务**
```bash
docker-compose up -d
```

3. **访问应用**
- 应用界面: http://localhost:3001

## 🔧 配置说明

### 环境变量配置

创建 `.env` 文件并配置以下变量：

```bash
# Supabase配置 (必需)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 基础货币设置 (可选，默认CNY)
BASE_CURRENCY=CNY

# 日志级别 (可选)
LOG_LEVEL=info
VITE_LOG_LEVEL=info

# 传统后端配置 (向后兼容)
API_KEY=your_secret_api_key_here
PORT=3001
```

### Supabase设置

1. **创建Supabase项目**
   - 访问 [Supabase Dashboard](https://supabase.com/dashboard)
   - 创建新项目

2. **配置认证**
   - 启用Google OAuth提供商
   - 设置回调URL: `http://localhost:5173/auth/callback`

3. **应用数据库迁移**
   ```bash
   # 使用Supabase CLI
   supabase db push
   
   # 或在SQL编辑器中运行迁移文件
   ```

4. **部署Edge Functions**
   ```bash
   supabase functions deploy
   ```

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
