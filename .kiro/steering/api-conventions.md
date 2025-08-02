# API约定

## RESTful API设计
- 使用标准HTTP方法：GET, POST, PUT, DELETE
- 资源URL使用复数形式：`/api/subscriptions`
- 使用适当的HTTP状态码
- 统一的错误响应格式

## 请求格式
- Content-Type: `application/json`
- 使用camelCase命名字段
- 日期格式使用ISO 8601标准
- 分页参数：`page`, `limit`

## 响应格式
```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 错误响应格式
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入数据验证失败",
    "details": []
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 状态码约定
- 200: 成功
- 201: 创建成功
- 400: 请求参数错误
- 401: 未授权
- 403: 禁止访问
- 404: 资源不存在
- 500: 服务器内部错误

## 数据验证
- 服务端验证所有输入数据
- 使用joi或类似库进行验证
- 返回详细的验证错误信息
- 防止SQL注入和XSS攻击

## API版本控制
- 在URL中包含版本号：`/api/v1/subscriptions`
- 保持向后兼容性
- 废弃的API提供迁移指南
- 使用语义化版本号

## 认证和授权
- 使用JWT token进行认证
- 在请求头中传递token：`Authorization: Bearer <token>`
- 实现适当的权限控制
- 定期刷新token