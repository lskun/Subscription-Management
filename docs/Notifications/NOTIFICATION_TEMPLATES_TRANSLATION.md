# 通知模板中英文对照表

## 概述

由于订阅管理系统主要面向英文用户，需要将统一通知模板表(unified_notification_templates)中的中文内容替换为英文。本文档记录了原有的中文模板内容和新的英文模板内容。

## 模板对照表

### 1. subscription_expiry - 订阅到期提醒

#### 原中文版本
- **Subject**: `⏰ {{subscriptionName}} 即将到期提醒`
- **Text Template**: 
```
订阅即将到期提醒

亲爱的 {{displayName}},

您的订阅服务 {{subscriptionName}} 将在 {{daysLeft}} 天后到期（{{expiryDate}}）。

请及时处理续费或取消订阅。

管理订阅：{{siteUrl}}/subscriptions
```

- **HTML Template**: 完整的HTML邮件模板，包含中文标题"订阅到期提醒"等

#### 新英文版本（聚合支持）
- **Subject**: `⏰ {{subscriptionCount}} Subscription(s) Expiring Soon`
- **Text Template**:
```
Subscription(s) Expiring Soon

Dear {{displayName}},

You have {{subscriptionCount}} subscription(s) expiring soon:

{{subscriptionList}}

Please review and manage your subscriptions as needed.

Manage your subscriptions: {{renewalUrl}}

Best regards,
Your Subscription Management Team
```

- **HTML Template**: 完整的英文HTML邮件模板，支持多订阅聚合显示，包含突出警告样式

### 2. payment_failed - 支付失败通知

#### 原中文版本
- **Subject**: `❌ {{subscriptionName}} 支付失败通知`
- **Text Template**:
```
支付失败

您的 {{subscriptionName}} 支付失败，金额：{{amount}} {{currency}}。
```

- **HTML Template**: 简单的HTML结构包含中文内容

#### 新英文版本
- **Subject**: `❌ Payment Failed for {{subscriptionName}}`
- **Text Template**:
```
Payment Failed

Your payment for {{subscriptionName}} has failed. Amount: {{amount}} {{currency}}.

Please update your payment method or contact support.

Manage your subscriptions: {{renewalUrl}}
```

- **HTML Template**: 对应的英文HTML结构

### 3. payment_success - 支付成功确认

#### 原中文版本
- **Subject**: `✅ {{subscriptionName}} 支付成功确认`
- **Text Template**:
```
支付成功

您的 {{subscriptionName}} 支付成功，金额：{{amount}} {{currency}}。
```

- **HTML Template**: 简单的HTML结构包含中文内容

#### 新英文版本
- **Subject**: `✅ Payment Confirmed for {{subscriptionName}}`
- **Text Template**:
```
Payment Successful

Your payment for {{subscriptionName}} has been processed successfully. Amount: {{amount}} {{currency}}.

Thank you for your continued subscription!

Manage your subscriptions: {{renewalUrl}}
```

- **HTML Template**: 对应的英文HTML结构

### 4. welcome - 欢迎邮件

#### 原中文版本
- **Subject**: `欢迎使用订阅管理器！🎉`
- **Text Template**:
```
欢迎使用订阅管理器！

亲爱的 {{displayName}}，

恭喜您成功注册订阅管理器！我们很高兴为您提供专业的订阅管理服务。

您现在可以享受的功能：
• 无限制添加和管理订阅
• 详细的费用分析和趋势图表
• 智能续费提醒
• 多币种支持和实时汇率
• 数据导入导出功能
• 个性化主题和设置

立即开始使用：{{dashboardUrl}}

如果您有任何问题或建议，请随时联系我们。

祝您使用愉快！
订阅管理器团队
```

- **HTML Template**: 完整的中文HTML邮件模板，包含欢迎标题、功能介绍和CTA按钮

#### 新英文版本
- **Subject**: `Welcome to Subscription Manager! 🎉`
- **Text Template**:
```
Welcome to Subscription Manager!

Dear {{displayName}},

Congratulations on successfully registering with Subscription Manager! We're excited to provide you with professional subscription management services.

Features you can now enjoy:
• Unlimited subscription management
• Detailed cost analysis and trend charts
• Smart renewal reminders
• Multi-currency support with real-time exchange rates
• Data import and export functionality
• Personalized themes and settings

Get started now: {{dashboardUrl}}

If you have any questions or suggestions, please feel free to contact us.

Best regards,
Subscription Manager Team
```

- **HTML Template**: 完整的英文HTML邮件模板

## 模板变量说明

所有模板支持以下变量替换：

### 基础变量
- `{{displayName}}`: 用户显示名称
- `{{subscriptionName}}`: 订阅服务名称（单个订阅时）
- `{{daysLeft}}`: 剩余天数
- `{{expiryDate}}`: 到期日期
- `{{amount}}`: 金额
- `{{currency}}`: 货币
- `{{renewalUrl}}`: 续费管理链接
- `{{dashboardUrl}}`: 仪表板链接（欢迎邮件专用）

### 聚合通知新增变量
- `{{subscriptionCount}}`: 到期订阅数量
- `{{subscriptionList}}`: 纯文本格式的订阅列表
- `{{subscriptionListHtml}}`: HTML格式的订阅列表（带突出样式）
- `{{earliestExpiryDate}}`: 最早到期日期

### 兼容性说明
- 单个订阅时：使用原有变量格式
- 多个订阅时：主题和内容自动切换为聚合格式
- HTML模板包含突出显示样式：紧急订阅用红色，警告订阅用橙色

## 更新日期

- 创建日期: 2025-08-22
- 最新更新: 2025-08-24
- 更新原因: 系统面向英文用户，提升国际化用户体验
- 更新范围: 所有邮件通知模板的主题和内容，包括欢迎邮件模板