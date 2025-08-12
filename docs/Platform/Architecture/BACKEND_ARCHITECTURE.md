# 后端架构（Supabase 版）

本系统采用「无服务/托管后端」模式：以 Supabase 为核心的 Auth、Postgres（RLS）、PostgREST、Edge Functions 及存储/监控能力，前端通过 REST/RPC/Edge Functions 访问数据与计算，不再使用本地 Express/SQLite。

## 架构总览

```mermaid
graph LR
  FE[Frontend (React/Vite/TS)] -->|Auth| AUTH[Supabase Auth]
  FE -->|REST/RPC| DB[(Postgres + RLS)]
  FE -->|HTTP| EDGE[Edge Functions]
  EDGE --> DB
  EDGE --> EXT[外部服务(邮件/汇率/监控)]
```

- Auth: OAuth 会话、Token、行级安全（RLS）上下文
- PostgREST: 自动生成的 REST/RPC 接口（受 RLS 保护）
- Edge Functions: 复杂聚合/批处理/对外部服务调用
- 外部服务: TianAPI（汇率）、Resend（邮件，可选）、Supabase Metrics

## 主要后端组件
- 身份与权限
  - Supabase Auth（OAuth/Sessions）
  - RLS 策略按 `user_id` 约束行级访问；管理员能力经 `admin_*` 表和函数控制
- 数据接口
  - REST: `/rest/v1/<table>`，受 RLS 控制
  - RPC: `/rest/v1/rpc/<function>`，用于过程化操作（如续费）
  - Edge Functions: `/functions/v1/<name>`，用于复杂聚合或跨服务调用
- 计算与任务
  - Edge: `dashboard-analytics`, `expense-reports`, `subscriptions-management`, `update-exchange-rates`, `send-welcome-email`, `send-notification-email`, `database-metrics`, `handle-new-user`

## 数据库域模型（按功能域）
- Subscriptions 域
  - `subscriptions`, `categories`, `payment_methods`, `payment_history`
- Rates 域
  - `exchange_rates`, `exchange_rate_history`, `exchange_rate_update_logs`
- 用户/设置/偏好
  - `user_profiles`, `user_settings`, `user_email_preferences`, `user_notification_preferences`
- 平台订阅计划
  - `subscription_plans`, `user_subscriptions`
- 通知/邮件
  - `notification_templates`, `user_notifications`, `email_templates`, `email_logs`, `email_queue`
- 管理员/系统
  - `admin_roles`, `admin_users`, `admin_sessions`, `admin_operation_logs`
  - `system_settings`, `system_health`, `system_stats`, `system_logs`

> 以上表名已与当前 Supabase 数据库一致（基于最新 Schema 枚举）。

## 关键流程
- 用户初始化
  - 触发: 新用户注册 → `handle-new-user`
  - 写入: `user_profiles`, `user_settings`（默认设置）
- 仪表盘/报表
  - `dashboard-analytics`/`expense-reports` 聚合查询 → 读取订阅/支付/汇率并整合
- 订阅管理与续费
  - `subscriptions-management` 汇总/筛选列表（内部 RPC `get_managed_subscriptions`）
  - RPC `process_subscription_renewal(subscription_id, user_id)` 执行续费、写 `payment_history`
- 汇率更新
  - `update-exchange-rates` 拉取 TianAPI，写 `exchange_rates`，记录 `exchange_rate_update_logs`，归档到 `exchange_rate_history`
- 通知与邮件
  - `send-welcome-email`/`send-notification-email`，并记录 `email_logs`/`email_queue`，站内 `user_notifications`
- 系统监控
  - `database-metrics` 解析 Supabase Metrics，写入 `system_*` 表（如有）

### 数据库特性

#### 外键约束
- 确保数据引用完整性
- 支持级联删除操作
- 防止孤立数据产生

#### 自动时间戳
```sql
-- 创建触发器自动更新 updated_at 字段
CREATE TRIGGER update_subscriptions_updated_at 
    AFTER UPDATE ON subscriptions
    FOR EACH ROW
    BEGIN
        UPDATE subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
```

#### 性能索引
```sql
-- 为常用查询字段创建索引
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing_date);
CREATE INDEX idx_payment_history_subscription ON payment_history(subscription_id);
CREATE INDEX idx_payment_history_date ON payment_history(payment_date);
```

## 安全与访问控制
- 核心依赖 Postgres RLS：
  - 普通用户仅可读写自身 `user_id` 相关行
  - `categories`/`payment_methods` 默认项具备匿名只读（必要时）
  - `exchange_rates` 仅服务角色可写；普通用户可读
  - 管理员表与操作经 `admin_users`/`admin_roles` 及相关函数校验
- 边界：涉及外部 API 的写入操作仅在 Edge 或服务角色下执行

### 环境变量
```bash
# 必需配置
API_KEY=your_secret_api_key_here

# 可选配置
PORT=3001
BASE_CURRENCY=CNY
NODE_ENV=production
DATABASE_PATH=/app/data/database.sqlite
TIANAPI_KEY=your_tianapi_key_here
```

## 迁移与版本
- 迁移示例（节选）：
  - `006_enhance_rls_policies_*`, `007_fix_rls_anonymous_access_*`
  - `enhance_exchange_rates` 及后续若干汇率相关迁移
  - `email_notification_system_fixed`, `user_notifications_system`
  - `admin_system`, `create_system_settings_table`, `create_system_monitoring_tables`
  - 支付状态与索引：`step1_remove_payment_status_constraint` → `add_payment_validation_constraints`

迁移通过 Supabase CLI/Studio 执行与追踪，详细请参考 `docs/Platform/Database/*` 与 `docs/Platform/Migration/*`。

### 错误处理中间件 (middleware/errorHandler.js)
```javascript
// 异步错误处理包装器
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// 全局错误处理器
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    // 数据库错误处理
    if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ 
            error: 'Database constraint violation' 
        });
    }
    
    // 默认错误响应
    res.status(500).json({ 
        error: 'Internal server error' 
    });
};

// 404处理器
const notFoundHandler = (req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found' 
    });
};
```

## 接口速览（示例）
- REST
  - `GET /rest/v1/subscriptions?select=*&order=updated_at.desc`
- RPC
  - `POST /rest/v1/rpc/process_subscription_renewal`（JSON: `{ subscription_id, user_id }`）
- Edge Functions
  - `POST /functions/v1/expense-reports`、`POST /functions/v1/subscriptions-management`
  - `POST /functions/v1/update-exchange-rates`、`GET /functions/v1/database-metrics`

### 特性
- **通用CRUD操作**: 标准化的数据库操作
- **灵活查询**: 支持条件查询、排序、分页
- **事务支持**: 确保数据一致性
- **参数化查询**: 防止SQL注入
- **错误处理**: 统一的错误处理机制

## 与旧文档差异说明
- 本文档取代旧的「Node.js + Express + SQLite」说明，现网实现基于 Supabase（Auth/RLS/PostgREST/Edge）。
- 如需历史参考，请查看 `docs/Project/STRUCTURE.md` 与本文件的 Git 历史。

### 响应处理工具 (utils/responseHelper.js)
```javascript
// 成功响应
const success = (res, data, message = 'Success') => {
    res.json({ data, message });
};

// 查询结果处理
const handleQueryResult = (res, result, resourceName) => {
    if (Array.isArray(result)) {
        res.json(result);
    } else if (result) {
        res.json(result);
    } else {
        res.status(404).json({ 
            error: `${resourceName} not found` 
        });
    }
};

// 数据库操作结果处理
const handleDbResult = (res, result, successMessage, notFoundMessage) => {
    if (result.changes > 0) {
        res.json({ message: successMessage });
    } else {
        res.status(404).json({ error: notFoundMessage });
    }
};
```

## 🔧 业务逻辑层

业务逻辑层封装复杂的业务规则和数据处理逻辑。

### 服务类示例
```javascript
class SubscriptionService extends BaseRepository {
    constructor(db) {
        super(db, 'subscriptions');
        this.paymentHistoryService = new PaymentHistoryService(db);
    }
    
    // 创建订阅（包含业务逻辑）
    async createSubscription(subscriptionData) {
        const {
            name, plan, billing_cycle, next_billing_date,
            amount, currency, payment_method_id, start_date,
            status = 'active', category_id, renewal_type = 'manual',
            notes, website
        } = subscriptionData;
        
        // 计算上次计费日期
        const last_billing_date = this.calculateLastBillingDate(
            next_billing_date, start_date, billing_cycle
        );
        
        // 使用事务确保数据一致性
        const result = this.transaction(() => {
            // 创建订阅
            const subscriptionResult = this.create({
                name, plan, billing_cycle, next_billing_date,
                last_billing_date, amount, currency, payment_method_id,
                start_date, status, category_id, renewal_type, notes, website
            });
            
            // 创建初始支付记录
            if (status === 'active' && start_date) {
                this.paymentHistoryService.createPaymentRecord({
                    subscription_id: subscriptionResult.lastInsertRowid,
                    payment_date: start_date,
                    amount_paid: amount,
                    currency: currency,
                    billing_period_start: start_date,
                    billing_period_end: next_billing_date
                });
            }
            
            return subscriptionResult;
        });
        
        return result;
    }
    
    // 业务逻辑：计算上次计费日期
    calculateLastBillingDate(nextBillingDate, startDate, billingCycle) {
        const nextDate = new Date(nextBillingDate);
        const startDateObj = new Date(startDate);
        
        switch (billingCycle) {
            case 'monthly':
                return new Date(nextDate.setMonth(nextDate.getMonth() - 1));
            case 'yearly':
                return new Date(nextDate.setFullYear(nextDate.getFullYear() - 1));
            case 'quarterly':
                return new Date(nextDate.setMonth(nextDate.getMonth() - 3));
            default:
                return startDateObj;
        }
    }
}
```

## 🔄 定时任务系统

### 汇率更新调度器
```javascript
class ExchangeRateScheduler {
    constructor(db, apiKey) {
        this.db = db;
        this.apiKey = apiKey;
        this.exchangeRateService = new ExchangeRateService(db);
        this.job = null;
    }
    
    start() {
        // 每天凌晨2点更新汇率
        this.job = cron.schedule('0 2 * * *', async () => {
            console.log('🔄 Starting scheduled exchange rate update...');
            await this.updateExchangeRates();
        }, {
            scheduled: false,
            timezone: 'Asia/Shanghai'
        });
        
        this.job.start();
        console.log('✅ Exchange rate scheduler started');
    }
    
    async updateExchangeRates() {
        try {
            if (!this.apiKey) {
                console.log('⚠️ No API key provided, skipping exchange rate update');
                return { success: false, message: 'No API key configured' };
            }
            
            // 调用天行数据API获取汇率
            const response = await axios.get(`https://apis.tianapi.com/fxrate/index`, {
                params: { key: this.apiKey }
            });
            
            if (response.data.code === 200) {
                const rates = response.data.result;
                await this.exchangeRateService.updateRates(rates);
                
                console.log('✅ Exchange rates updated successfully');
                return { 
                    success: true, 
                    message: 'Exchange rates updated successfully',
                    updatedAt: new Date().toISOString()
                };
            } else {
                throw new Error(`API error: ${response.data.msg}`);
            }
        } catch (error) {
            console.error('❌ Failed to update exchange rates:', error);
            return { 
                success: false, 
                message: error.message 
            };
        }
    }
}
```

### 订阅续费调度器
```javascript
class SubscriptionRenewalScheduler {
    constructor(db) {
        this.db = db;
        this.subscriptionManagementService = new SubscriptionManagementService(db);
        this.job = null;
    }
    
    start() {
        // 每天凌晨1点检查续费
        this.job = cron.schedule('0 1 * * *', async () => {
            console.log('🔄 Starting scheduled subscription maintenance...');
            await this.runMaintenance();
        }, {
            scheduled: false,
            timezone: 'Asia/Shanghai'
        });
        
        this.job.start();
        console.log('✅ Subscription renewal scheduler started');
    }
    
    async runMaintenance() {
        try {
            // 处理自动续费
            const autoRenewalResult = await this.subscriptionManagementService.processAutoRenewals();
            
            // 处理过期订阅
            const expiredResult = await this.subscriptionManagementService.processExpiredSubscriptions();
            
            console.log('✅ Subscription maintenance completed:', {
                autoRenewals: autoRenewalResult,
                expiredProcessed: expiredResult
            });
            
            return {
                success: true,
                autoRenewals: autoRenewalResult,
                expiredProcessed: expiredResult
            };
        } catch (error) {
            console.error('❌ Subscription maintenance failed:', error);
            return { success: false, error: error.message };
        }
    }
}
```

## 🛣 路由系统

### 路由组织
采用模块化路由设计，分为公开路由和受保护路由。

```javascript
// server.js 中的路由配置
const apiRouter = express.Router();
const protectedApiRouter = express.Router();

// 应用认证中间件到受保护路由
protectedApiRouter.use(apiKeyAuth);

// 注册路由模块
apiRouter.use('/subscriptions', createSubscriptionRoutes(db));
protectedApiRouter.use('/subscriptions', createProtectedSubscriptionRoutes(db));
protectedApiRouter.use('/subscriptions', createSubscriptionManagementRoutes(db));

// 注册到应用
app.use('/api', apiRouter);
app.use('/api/protected', protectedApiRouter);
```

### 路由模块示例
```javascript
// routes/subscriptions.js
function createSubscriptionRoutes(db) {
    const router = express.Router();
    const controller = new SubscriptionController(db);
    
    // 公开接口
    router.get('/', controller.getAllSubscriptions);
    router.get('/:id', controller.getSubscriptionById);
    router.get('/stats/overview', controller.getSubscriptionStats);
    
    return router;
}

function createProtectedSubscriptionRoutes(db) {
    const router = express.Router();
    const controller = new SubscriptionController(db);
    
    // 受保护接口
    router.post('/', controller.createSubscription);
    router.put('/:id', controller.updateSubscription);
    router.delete('/:id', controller.deleteSubscription);
    
    return router;
}
```

## 🔍 数据验证

### 验证工具 (utils/validator.js)
```javascript
const createValidator = (schema) => {
    return (data) => {
        const errors = [];
        
        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];
            
            // 必填验证
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                continue;
            }
            
            // 类型验证
            if (value !== undefined && rules.type) {
                if (rules.type === 'number' && isNaN(value)) {
                    errors.push(`${field} must be a number`);
                }
                if (rules.type === 'string' && typeof value !== 'string') {
                    errors.push(`${field} must be a string`);
                }
            }
            
            // 枚举验证
            if (value !== undefined && rules.enum && !rules.enum.includes(value)) {
                errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
            }
            
            // 长度验证
            if (value !== undefined && rules.maxLength && value.length > rules.maxLength) {
                errors.push(`${field} must not exceed ${rules.maxLength} characters`);
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    };
};

// 使用示例
const subscriptionValidator = createValidator({
    name: { required: true, type: 'string', maxLength: 100 },
    amount: { required: true, type: 'number' },
    billing_cycle: { required: true, enum: ['monthly', 'yearly', 'quarterly'] },
    status: { enum: ['active', 'inactive', 'cancelled'] }
});
```

## 📊 日志系统

### 日志工具 (utils/logger.js)
```javascript
const logger = {
    info: (message, data = {}) => {
        console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
    },
    
    error: (message, error = {}) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
    },
    
    warn: (message, data = {}) => {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data);
    },
    
    debug: (message, data = {}) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, data);
        }
    }
};
```

## 🚀 启动流程

### 应用启动序列
1. **环境配置加载** - 读取.env文件和环境变量
2. **数据库初始化** - 检查并创建数据库表结构
3. **中间件配置** - 设置CORS、JSON解析等中间件
4. **定时任务启动** - 启动汇率更新和订阅维护任务
5. **路由注册** - 注册所有API路由
6. **静态文件服务** - 配置前端静态文件服务
7. **错误处理** - 设置全局错误处理中间件
8. **服务器启动** - 监听指定端口

### 启动脚本 (start.sh)
```bash
#!/bin/bash

echo "🚀 Starting Subscription Management Server..."

# 检查数据库目录
if [ ! -d "db" ]; then
    echo "📁 Creating database directory..."
    mkdir -p db
fi

# 初始化数据库
echo "🔄 Initializing database..."
node db/init.js

# 启动服务器
echo "🌟 Starting server..."
node server.js
```

## 🔒 安全考虑

### API密钥认证
- 所有写操作需要API密钥验证
- 密钥通过环境变量配置
- 支持密钥自动生成

### 数据验证
- 输入参数严格验证
- SQL注入防护
- 数据类型检查

### 错误处理
- 敏感信息不暴露给客户端
- 统一错误响应格式
- 详细的服务器端日志

## 📈 性能优化

### 数据库优化
- 关键字段索引
- 查询语句优化
- 事务使用

### 缓存策略
- 汇率数据缓存
- 统计数据预计算
- 查询结果缓存

### 资源管理
- 数据库连接池
- 内存使用监控
- 定时任务优化
