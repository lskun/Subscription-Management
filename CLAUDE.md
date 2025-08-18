# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Core Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Type checking
tsc -b
```

### Testing
```bash
# Run unit tests
npm run test

# Run specific test file
npm run test:auto-renew

# Run unit tests with UI
npm run test:ui

# Run E2E tests
npm run test:e2e

# Run specific E2E test suites
npm run test:e2e:auth
npm run test:e2e:database
npm run test:e2e:session
npm run test:e2e:integration
```

### Database & Supabase
```bash
# Check Supabase configuration
npm run check-supabase

# Validate SQL migrations
npm run validate-sql

# Test Edge Functions
npm run test-edge-function

# Verify auto-renewal batch processing
npm run verify:auto-renew-batch
```

## Project Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS + shadcn/ui + Radix UI
- **State Management**: Zustand with persistence
- **Routing**: React Router v6
- **Charts**: Recharts
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Testing**: Vitest (unit) + Playwright (E2E)

### Core System Architecture

This is a subscription management SaaS platform with multi-tenant architecture:

1. **Authentication Layer**: Google OAuth via Supabase Auth with session management
2. **Authorization**: Row Level Security (RLS) policies for data isolation
3. **Admin System**: Separate admin authentication and permission management
4. **Data Layer**: PostgreSQL with comprehensive schema for subscriptions, payments, categories
5. **Edge Functions**: Deno-based serverless functions for complex operations
6. **Real-time Features**: Supabase Realtime for notifications and data sync

### Key Modules

#### Store Architecture (Zustand)
- `subscriptionStore.ts`: Main subscription state with optimistic updates
- `settingsStore.ts`: User preferences and configuration
- `useMonthlyExpenses.ts`: Monthly expense calculations and caching

#### Service Layer
Services follow a consistent pattern with Supabase integration:
- `supabaseSubscriptionService.ts`: Core subscription CRUD operations
- `dashboardAnalyticsService.ts`: Dashboard data aggregation
- `expenseReportsEdgeFunctionService.ts`: Complex reporting via Edge Functions
- `authService.ts`: Authentication and session management
- `adminAuthService.ts`: Admin-specific authentication

#### Edge Functions (Deno)
Located in `supabase/functions/`:
- `dashboard-analytics/`: Aggregated dashboard data
- `expense-reports/`: Complex expense report calculations
- `subscriptions-management/`: Subscription operations
- `auto-renew-subscriptions/`: Automated renewal processing
- `update-exchange-rates/`: Currency rate updates

### Database Schema

#### Core Tables
- `user_profiles`: User profile and preferences
- `subscriptions`: Main subscription data with status tracking
- `categories`: Custom subscription categories per user
- `payment_methods`: User payment methods
- `payment_history`: Complete payment record tracking
- `exchange_rates`: Multi-currency support with history

#### Admin System
- `admin_users`: Admin user accounts separate from regular users
- `admin_roles`: Role-based permission system
- `admin_operation_logs`: Audit trail for admin operations

#### Notification System
- `user_notifications`: In-app notifications
- `email_logs`: Email delivery tracking
- `user_email_preferences`: Email notification preferences

### Component Organization

#### Layout Components
- `MainLayout.tsx`: Main application wrapper with navigation
- `ProtectedRoute.tsx`: Authentication guards for routes

#### Feature Components
- `components/subscription/`: Subscription management UI
- `components/charts/`: Data visualization components
- `components/admin/`: Admin panel components
- `components/auth/`: Authentication and session components

#### Form Patterns
Forms use react-hook-form with shadcn/ui components:
- Validation schemas in separate files
- Reusable form field components
- Optimistic updates for better UX

### State Management Patterns

#### Optimistic Updates
The app uses optimistic updates extensively:
1. Immediate UI updates on user actions
2. Rollback on API errors
3. Background sync with server state

#### Cache Strategy
- Zustand persist middleware for client-side caching
- Cache invalidation on mutations
- Real-time updates via Supabase subscriptions

### Authentication Flow

#### User Authentication
1. Google OAuth via Supabase Auth
2. Session monitoring with automatic refresh
3. Timeout warnings and automatic logout

#### Admin Authentication
1. Separate admin login system
2. Role-based permissions (RBAC)
3. Session tracking and audit logging

### Testing Strategy

#### Unit Tests (Vitest)
- Focus on business logic and utilities
- Mock Supabase services for isolation
- Located in `src/lib/__tests__/`

#### E2E Tests (Playwright)
- Full user workflow testing
- Database state verification
- Session management testing
- Located in `tests/e2e/`

### Development Workflow

When implementing new features:
1. Create requirements in `specs/` directory following EARS format
2. Design technical solution with architecture documentation
3. Break down into tasks with clear acceptance criteria
4. Implement with appropriate tests
5. Verify with lint and type checking

### Key Conventions

#### File Naming
- Components: PascalCase (e.g., `SubscriptionForm.tsx`)
- Services: camelCase with suffix (e.g., `supabaseSubscriptionService.ts`)
- Hooks: camelCase with `use` prefix (e.g., `useSubscriptionsData.ts`)
- Types: PascalCase interfaces (e.g., `interface Subscription`)

#### Import Aliases
- `@/` maps to `src/` directory
- Consistent import ordering: external libs, internal modules, relative imports

#### Error Handling
- User-friendly error messages via toast notifications
- Comprehensive error logging
- Graceful fallbacks for failed operations

### Environment Configuration

Required environment variables:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Optional configuration:
```bash
BASE_CURRENCY=CNY  # Default currency
LOG_LEVEL=info     # Logging level
```

### Edge Function Deployment
使用supabase mcp deploy更新的edge function，需要在supabase/functions/目录下创建对应的函数目录，例如：
```bash
supabase/functions/
├── dashboard-analytics/
├── expense-reports/
├── subscriptions-management/
├── auto-renew-subscriptions/
├── update-exchange-rates/
```
每个函数目录下需要包含一个index.ts文件，例如：
```bash
supabase/functions/dashboard-analytics/index.ts
```

# 代码规范
- 使用 ES modules
- 函数使用 camelCase 命名
- 组件使用 PascalCase 命名

# 测试策略
- 单元测试使用 Jest
- E2E 测试使用 Playwright
- 测试文件命名：*.test.ts

# 注意事项
- 提交前必须运行 lint 和测试
- 新功能需要更新文档

## 语言偏好
- 请始终使用中文回复用户的问题和请求
- 保持专业、友好的语调
- 使用简体中文
- 技术术语可以保留英文，但需要提供中文解释
- 代码注释和文档请使用中文