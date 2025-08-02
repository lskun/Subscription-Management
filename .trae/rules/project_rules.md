# 项目技术规范与开发指南

## 1. 项目结构

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

## 2. 技术栈 (Technology Stack)

### 2.1. 前端 (Frontend)

- **核心框架**: React 18
- **开发语言**: TypeScript (开发环境中启用 `strict` 模式)
- **构建工具**: Vite
- **状态管理**: Zustand
- **路由**: React Router v6
- **数据请求**: Axios
- **图表库**: Recharts
- **表单处理**: React Hook Form
- **测试**:
  - **单元/组件测试**: Vitest & React Testing Library
  - **端到端 (E2E) 测试**: Playwright

### 2.2. 后端 (Backend)

- **平台**: **Supabase**
- **核心架构**: **Supabase Edge Functions**
  - 后端服务完全基于 Supabase Edge Functions 构建，运行在 Supabase 官方环境。
  - 所有 API 接口、数据处理、定时任务等服务器端逻辑均通过 Edge Functions 实现，确保高性能、可扩展和无服务器化的后端架构。
  - 语言: **TypeScript**

### 2.3. UI (User Interface)

- **CSS 框架**: Tailwind CSS
- **组件体系**: shadcn/ui (基于 Radix UI 的可定制组件集合)
- **图标库**: Lucide React
- **主题**: 支持明/暗模式切换 (`next-themes`)

---

## 3. 项目规则 (Project Rules)

### 3.1. 代码规范与组织

- **命名规范**:
  - **组件 & 目录**: `PascalCase` (例如: `src/components/SubscriptionList.tsx`)
  - **工具函数 & Hooks**: `camelCase` (例如: `src/hooks/useDataFetcher.ts`)
  - **常量**: `UPPER_SNAKE_CASE` (例如: `src/config/constants.ts`)
- **代码结构**:
  - **功能模块化**: 严格按功能组织文件，相关业务逻辑（组件、Hooks、类型定义）应聚合在同一模块目录中。
  - **关注点分离**: 遵循 `src` 下的目录结构，如 `components`, `hooks`, `pages`, `services`, `store`, `types`, `utils`。
- **TypeScript**:
  - 必须为所有 Props、函数返回值和状态定义明确的类型。
  - 严禁使用 `any` 类型，应使用更具体的类型或 `unknown`。


### 3.2. API 设计与通信

- **设计原则**: 遵循 RESTful 风格进行设计。
- **响应格式**: 所有 API 响应必须遵循统一格式：
  ```json
  {
    "success": true,
    "data": {},
    "message": "操作成功"
  }
  ```
- **认证**: 所有需要认证的请求必须在请求头中携带 JWT: `Authorization: Bearer <token>`。

### 3.3. 测试策略

- **测试金字塔**:
  - **单元测试**: 优先测试独立的工具函数、Hooks 和业务逻辑。
  - **组件测试**: 测试组件的渲染、交互和状态变化。
  - **E2E 测试**: 使用 Playwright 覆盖核心用户流程，如登录、创建订阅、数据筛选等。
- **代码覆盖率**: 单元测试和组件测试的目标覆盖率应保持在 **80%** 以上。
- **测试脚本**: `package.json` 中定义了完整的测试命令，提交代码前必须确保所有测试通过。

### 3.4. UI/UX 设计指南

- **一致性**: 必须复用 `src/components/ui` 中定义的基础组件，以确保整个应用的视觉和交互一致性。
- **响应式设计**: 所有页面和组件必须支持响应式布局，在桌面和移动设备上均有良好的展示效果。
- **可访问性 (A11y)**:
  - 确保所有交互元素都支持键盘导航。
  - 保证文本与背景色之间有足够的对比度。

### 3.5. Supabase Edge Functions 开发规范

- **创建与更新**: 所有 Supabase Edge Functions 的创建和更新操作必须使用 Supabase MCP 工具进行。
  - 禁止使用传统的 `supabase functions deploy` 命令直接部署。
- **版本控制**: 每次更新 Edge Function 时，必须记录版本变更和功能说明。
- **错误处理**: Edge Functions 必须实现完善的错误处理机制，确保返回统一格式的错误响应。
