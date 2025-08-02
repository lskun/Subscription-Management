# 编码规范

## TypeScript规范
- 使用严格的TypeScript配置
- 为所有函数和组件定义明确的类型
- 避免使用`any`类型，优先使用具体类型或泛型
- 使用接口(interface)定义对象结构
- 导出类型定义供其他模块使用

## React组件规范
- 使用函数组件和Hooks
- 组件名使用PascalCase命名
- 将复杂逻辑提取到自定义Hooks中
- 使用React.memo优化性能（当需要时）
- 保持组件单一职责原则

## 文件命名规范
- 组件文件使用PascalCase: `SubscriptionCard.tsx`
- 工具函数文件使用camelCase: `dateUtils.ts`
- 常量文件使用UPPER_CASE: `constants.ts`
- 类型定义文件使用camelCase: `types.ts`

## 代码组织
- 按功能模块组织代码结构
- 相关文件放在同一目录下
- 使用barrel exports (index.ts) 简化导入
- 将可复用的逻辑提取到utils或hooks中

## API设计规范
- 使用RESTful API设计原则
- 统一的错误处理和响应格式
- 使用适当的HTTP状态码
- API路径使用kebab-case
- 请求和响应数据使用camelCase

## 数据库规范
- 表名使用snake_case
- 字段名使用snake_case
- 使用有意义的字段名
- 添加适当的索引
- 使用外键约束确保数据完整性