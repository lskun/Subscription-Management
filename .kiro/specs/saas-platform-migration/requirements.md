# SaaS平台改造需求文档

## 介绍

本项目旨在将现有的单用户订阅管理系统改造为一个完整的SaaS（Software as a Service）平台。改造后的系统将支持多租户架构，允许多个用户和组织独立使用订阅管理功能，同时提供订阅计费、用户管理、数据隔离等企业级功能。

当前系统是一个基于React + Node.js + SQLite的单用户订阅管理应用，主要功能包括订阅管理、费用跟踪、支付历史、数据分析等。改造后将使用Supabase作为后端服务，成为一个可扩展的多租户SaaS平台，支持用户注册、订阅付费、数据隔离和企业级管理功能。改造将优先专注于Web端功能实现。

## 需求

### 需求1：用户认证和账户管理

**用户故事：** 作为一个潜在用户，我希望能够通过Gmail或邮箱注册账户、登录系统并管理我的个人资料，以便开始使用订阅管理服务。

#### 验收标准

1. WHEN 用户访问登录页面 THEN 系统 SHALL 优先显示"使用Gmail登录"按钮
2. WHEN 用户点击Gmail登录 THEN 系统 SHALL 通过Supabase集成Google OAuth进行认证
3. WHEN Gmail认证成功 THEN 系统 SHALL 自动创建用户账户并完成登录
4. WHEN 用户选择邮箱注册 THEN 系统 SHALL 提供邮箱、密码、确认密码和基本信息输入字段
5. WHEN 用户提交有效的注册信息 THEN 系统 SHALL 通过Supabase创建新账户并发送邮箱验证链接
6. WHEN 用户点击邮箱验证链接 THEN 系统 SHALL 激活账户并允许用户登录
7. WHEN 用户输入正确的邮箱和密码 THEN 系统 SHALL 通过Supabase验证凭据并创建会话
8. WHEN 用户请求密码重置 THEN 系统 SHALL 通过Supabase发送重置链接到注册邮箱
9. WHEN 用户访问个人资料页面 THEN 系统 SHALL 显示可编辑的用户信息
10. IF 用户连续3次登录失败 THEN 系统 SHALL 临时锁定账户15分钟

### 需求2：基于Supabase的多租户数据架构

**用户故事：** 作为系统管理员，我需要利用Supabase的RLS（Row Level Security）功能确保每个用户的数据完全隔离，以保护用户隐私和数据安全。

#### 验收标准

1. WHEN 用户注册成功 THEN 系统 SHALL 在Supabase中为该用户创建独立的用户记录
2. WHEN 用户访问任何数据 THEN 系统 SHALL 通过Supabase RLS仅返回属于该用户的数据
3. WHEN 执行数据库查询 THEN Supabase RLS SHALL 自动添加用户ID过滤条件
4. WHEN 用户删除账户 THEN 系统 SHALL 通过Supabase完全删除该用户的所有数据
5. IF 发生数据泄露尝试 THEN Supabase RLS SHALL 阻止跨用户数据访问并记录安全日志
6. WHEN 系统备份数据 THEN Supabase SHALL 保持用户数据的隔离性
7. WHEN 配置数据表 THEN 系统 SHALL 为所有业务表启用RLS并设置适当的策略

### 需求3：订阅计划和计费系统

**用户故事：** 作为平台运营者，我需要提供不同的订阅计划并处理用户付费，以实现平台的商业化运营。

#### 验收标准

1. WHEN 新用户注册 THEN 系统 SHALL 自动分配免费试用计划
2. WHEN 用户查看订阅计划 THEN 系统 SHALL 显示免费版、基础版、专业版的功能对比
3. WHEN 用户选择付费计划 THEN 系统 SHALL 集成支付网关处理付款
4. WHEN 付款成功 THEN 系统 SHALL 立即升级用户权限并发送确认邮件
5. WHEN 订阅即将到期 THEN 系统 SHALL 提前7天发送续费提醒
6. WHEN 订阅过期 THEN 系统 SHALL 降级到免费计划并限制功能访问
7. WHEN 用户取消订阅 THEN 系统 SHALL 在当前计费周期结束后降级
8. WHEN 生成发票 THEN 系统 SHALL 包含详细的计费信息和税务信息

### 需求4：功能配额和使用限制

**用户故事：** 作为产品经理，我需要根据不同订阅计划限制用户的功能使用，以实现差异化定价。

#### 验收标准

1. WHEN 免费用户添加订阅 THEN 系统 SHALL 限制最多10个订阅项目
2. WHEN 基础版用户添加订阅 THEN 系统 SHALL 限制最多50个订阅项目
3. WHEN 专业版用户添加订阅 THEN 系统 SHALL 允许无限制添加订阅
4. WHEN 用户达到配额限制 THEN 系统 SHALL 显示升级提示并阻止继续添加
5. WHEN 用户调用API THEN 系统 SHALL 根据订阅计划限制每小时请求次数
6. IF API调用超过限制 THEN 系统 SHALL 返回429状态码并提示升级
7. WHEN 用户导入数据 THEN 系统 SHALL 根据计划限制文件大小和导入频次

### 需求5：管理后台系统

**用户故事：** 作为系统管理员，我需要一个管理后台来监控用户、管理订阅、查看系统状态和处理客户支持。

#### 验收标准

1. WHEN 管理员登录后台 THEN 系统 SHALL 显示用户总数、活跃用户、收入等关键指标
2. WHEN 管理员查看用户列表 THEN 系统 SHALL 显示用户信息、订阅状态、使用情况
3. WHEN 管理员搜索用户 THEN 系统 SHALL 支持按邮箱、姓名、订阅状态筛选
4. WHEN 管理员查看用户详情 THEN 系统 SHALL 显示完整的用户资料和使用历史
5. WHEN 管理员需要协助用户 THEN 系统 SHALL 允许临时访问用户账户（记录操作日志）
6. WHEN 系统出现异常 THEN 系统 SHALL 在后台显示错误日志和性能监控
7. WHEN 管理员查看收入报告 THEN 系统 SHALL 提供按时间、计划类型的收入分析

### 需求6：基于Supabase的API安全和访问控制

**用户故事：** 作为开发者，我需要利用Supabase的安全机制确保只有授权用户才能访问相应的数据和功能。

#### 验收标准

1. WHEN 用户调用API THEN Supabase SHALL 验证JWT token的有效性
2. WHEN token过期 THEN Supabase SHALL 返回401状态码并要求重新认证
3. WHEN 用户访问资源 THEN Supabase RLS SHALL 验证用户是否有相应权限
4. WHEN 检测到可疑活动 THEN Supabase SHALL 记录安全日志并可选择性阻止访问
5. WHEN API调用频率异常 THEN 系统 SHALL 利用Supabase的速率限制保护
6. IF 发现恶意请求 THEN Supabase SHALL 临时封禁相关访问
7. WHEN 用户更改密码 THEN Supabase SHALL 使所有现有token失效
8. WHEN 配置API访问 THEN 系统 SHALL 使用Supabase的服务密钥和匿名密钥管理

### 需求7：数据导入导出功能

**用户故事：** 作为用户，我希望能够导入现有的订阅数据并支持数据的导出功能，以便管理我的订阅信息。

#### 验收标准

1. WHEN 用户导出数据 THEN 系统 SHALL 提供CSV、JSON格式的完整数据导出
2. WHEN 用户导入数据 THEN 系统 SHALL 验证数据格式并处理重复项
3. WHEN 导入失败 THEN 系统 SHALL 提供详细的错误报告和修复建议
4. IF 导入数据超过配额 THEN 系统 SHALL 提示用户升级订阅计划
5. WHEN 数据操作完成 THEN 系统 SHALL 显示操作结果通知
6. WHEN 用户导入CSV文件 THEN 系统 SHALL 支持标准的订阅数据格式
7. WHEN 导出数据 THEN 系统 SHALL 仅导出当前用户的数据

### 需求8：基于Supabase的性能优化和可扩展性

**用户故事：** 作为系统架构师，我需要利用Supabase的云基础设施确保系统能够处理大量用户和数据，提供良好的性能和可扩展性。

#### 验收标准

1. WHEN 系统用户数超过1000 THEN 系统 SHALL 利用Supabase的自动扩展保持响应时间在2秒以内
2. WHEN 数据库查询执行 THEN 系统 SHALL 在Supabase中使用适当的索引优化查询性能
3. WHEN 用户访问频繁的数据 THEN 系统 SHALL 利用Supabase的内置缓存机制
4. WHEN 系统负载增加 THEN Supabase SHALL 自动处理扩展需求
5. WHEN 执行大量数据操作 THEN 系统 SHALL 使用Supabase的实时功能和边缘函数
6. IF 系统资源使用率超过80% THEN Supabase监控 SHALL 发送告警通知管理员
7. WHEN 数据库连接数接近限制 THEN Supabase SHALL 自动管理连接池

### 需求9：基于Supabase的通知和邮件系统

**用户故事：** 作为用户，我希望及时收到关于订阅状态、付款、系统更新等重要信息的通知。

#### 验收标准

1. WHEN 用户注册成功 THEN 系统 SHALL 通过Supabase Edge Functions发送欢迎邮件和使用指南
2. WHEN 订阅即将到期 THEN 系统 SHALL 通过Supabase定时任务提前发送续费提醒邮件
3. WHEN 付款成功或失败 THEN 系统 SHALL 立即通过Supabase发送付款状态通知
4. WHEN 系统有重要更新 THEN 系统 SHALL 通过Supabase批量发送功能更新通知
5. WHEN 用户达到使用配额80% THEN 系统 SHALL 通过Supabase实时功能发送配额警告通知
6. WHEN 检测到异常登录 THEN Supabase Auth SHALL 发送安全警告邮件
7. IF 邮件发送失败 THEN Supabase Edge Functions SHALL 重试发送并记录失败日志
8. WHEN 配置邮件服务 THEN 系统 SHALL 集成第三方邮件服务（如SendGrid）与Supabase

### 需求10：现有功能完整性保障

**用户故事：** 作为现有系统的用户，我希望SaaS改造后能够保留所有现有的核心功能，确保功能不会因为多租户改造而丢失。

#### 验收标准

1. WHEN 用户管理订阅 THEN 系统 SHALL 支持完整的订阅CRUD操作（创建、读取、更新、删除）
2. WHEN 用户查看订阅 THEN 系统 SHALL 支持按状态、分类、支付方式等多维度筛选和搜索
3. WHEN 用户管理支付历史 THEN 系统 SHALL 提供详细的支付记录管理和历史查询功能
4. WHEN 用户查看数据分析 THEN 系统 SHALL 提供月度/年度收入统计、分类费用分析、趋势图表展示
5. WHEN 用户使用汇率功能 THEN 系统 SHALL 支持7种主要货币（USD, EUR, GBP, CAD, AUD, JPY, CNY）和实时汇率更新
6. WHEN 用户配置系统 THEN 系统 SHALL 支持自定义分类管理、支付方式配置、主题切换等设置功能
7. WHEN 用户导入导出数据 THEN 系统 SHALL 支持CSV、JSON格式的数据导入导出功能
8. WHEN 用户查看仪表板 THEN 系统 SHALL 提供智能费用概览、即将到期提醒、分类统计等功能
9. WHEN 用户处理续费 THEN 系统 SHALL 支持自动/手动续费类型设置和智能续费处理
10. WHEN 用户使用图表功能 THEN 系统 SHALL 提供基于Recharts的丰富图表展示（饼图、柱状图、趋势图等）

### 需求11：Web端响应式设计

**用户故事：** 作为Web用户，我希望能够在不同尺寸的浏览器窗口中正常使用所有功能，获得良好的用户体验。

#### 验收标准

1. WHEN 用户调整浏览器窗口大小 THEN 系统 SHALL 自动适配显示布局
2. WHEN 用户在平板尺寸浏览器中访问 THEN 系统 SHALL 提供适合触摸的交互元素
3. WHEN 网络较慢 THEN 系统 SHALL 优化加载速度和数据传输
4. WHEN 在小屏幕显示图表 THEN 系统 SHALL 提供可滚动或简化的图表视图
5. WHEN 用户使用键盘导航 THEN 系统 SHALL 提供完整的键盘访问支持
6. IF 浏览器不支持某些功能 THEN 系统 SHALL 提供替代方案或优雅降级
7. WHEN 用户在不同设备的浏览器中访问 THEN 系统 SHALL 保持功能完整性