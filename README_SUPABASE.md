# 订阅管理SaaS平台 - Supabase版本

这是订阅管理应用的SaaS版本，使用Supabase作为后端服务，支持多租户架构和Google OAuth认证。

## 🚀 快速开始

### 1. 环境准备

确保你已安装：
- Node.js 18+
- npm 或 yarn

### 2. 安装依赖

```bash
npm install
```

### 3. 配置Supabase

#### 3.1 创建Supabase项目
1. 访问 [Supabase](https://supabase.com) 并创建新项目
2. 记录项目URL和API密钥

#### 3.2 配置环境变量
复制环境变量模板：
```bash
cp .env.development.example .env
```

编辑 `.env` 文件，填入你的Supabase配置：
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### 3.3 运行数据库迁移
在Supabase SQL编辑器中运行以下迁移文件：
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_user_triggers.sql`

#### 3.4 配置Google OAuth
1. 在Google Cloud Console创建OAuth应用
2. 在Supabase Dashboard中配置Google认证提供商
3. 详细步骤请参考 `docs/SUPABASE_SETUP.md`

### 4. 验证配置

运行配置检查脚本：
```bash
npm run check-supabase
```

如果所有检查通过，你就可以开始开发了！

### 5. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173` 开始使用应用。

## 📁 项目结构

```
src/
├── components/          # React组件
│   ├── ui/             # UI组件库
│   └── ProtectedRoute.tsx  # 路由保护组件
├── contexts/           # React上下文
│   └── AuthContext.tsx # 认证上下文
├── lib/               # 工具库
│   └── supabase.ts    # Supabase客户端配置
├── pages/             # 页面组件
│   ├── LoginPage.tsx  # 登录页面
│   └── AuthCallbackPage.tsx  # OAuth回调页面
├── services/          # 服务层
│   └── authService.ts # 认证服务
└── types/             # TypeScript类型定义

supabase/
├── functions/         # Edge Functions
│   └── handle-new-user/  # 新用户处理函数
└── migrations/        # 数据库迁移文件
    ├── 001_initial_schema.sql
    └── 002_user_triggers.sql

docs/
└── SUPABASE_SETUP.md  # 详细设置指南
```

## 🔐 认证功能

### 支持的认证方式
- ✅ Google OAuth（推荐）
- ✅ 邮箱密码登录
- ✅ 用户注册
- ✅ 密码重置
- ✅ 会话管理

### 认证流程
1. 用户访问登录页面
2. 选择Google登录或邮箱登录
3. 认证成功后重定向到仪表板
4. 新用户自动分配免费订阅计划

## 🏗️ 多租户架构

### 数据隔离
- 使用Supabase Row Level Security (RLS)
- 每个用户只能访问自己的数据
- 自动的用户ID过滤

### 订阅计划
- 免费版：完整功能，无限制使用
- 预留付费计划扩展接口

## 🛠️ 开发指南

### 添加新功能
1. 在相应的表中添加RLS策略
2. 创建服务层API
3. 实现前端组件
4. 添加路由保护

### 数据库操作
```typescript
import { supabase } from '@/lib/supabase'

// 查询用户数据（自动应用RLS）
const { data, error } = await supabase
  .from('subscriptions')
  .select('*')
  .eq('status', 'active')
```

### 认证状态管理
```typescript
import { useAuth } from '@/contexts/AuthContext'

function MyComponent() {
  const { user, loading, signOut } = useAuth()
  
  if (loading) return <div>Loading...</div>
  if (!user) return <div>Please login</div>
  
  return <div>Welcome, {user.email}</div>
}
```

## 🧪 测试

### 运行配置检查
```bash
npm run check-supabase
```

### 测试认证流程
1. 访问 `/login` 页面
2. 测试Google OAuth登录
3. 测试邮箱密码登录
4. 验证用户数据隔离

## 📚 相关文档

- [Supabase设置指南](docs/SUPABASE_SETUP.md) - 详细的Supabase配置步骤
- [API文档](docs/API_DOCUMENTATION.md) - API接口说明
- [架构文档](docs/BACKEND_ARCHITECTURE.md) - 系统架构说明

## 🔧 故障排除

### 常见问题

1. **环境变量未加载**
   - 确认 `.env` 文件在项目根目录
   - 重启开发服务器

2. **Supabase连接失败**
   - 检查项目URL和API密钥
   - 确认网络连接正常

3. **Google OAuth失败**
   - 检查Google Cloud Console配置
   - 确认重定向URI正确

4. **RLS策略错误**
   - 检查数据库迁移是否完整
   - 确认用户已正确认证

### 获取帮助
- 查看浏览器开发者工具的控制台错误
- 检查Supabase项目日志
- 运行 `npm run check-supabase` 诊断配置问题

## 🚀 部署

### 生产环境配置
1. 设置生产环境的Supabase项目
2. 配置生产环境变量
3. 设置域名和SSL证书
4. 配置Google OAuth生产环境重定向URI

### 环境变量
```bash
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-prod-anon-key
```

## 📄 许可证

MIT License - 详见 LICENSE 文件

## 🤝 贡献

欢迎提交Issue和Pull Request！

---

**注意**：这是SaaS版本的订阅管理应用，如果你需要单用户版本，请查看主分支。