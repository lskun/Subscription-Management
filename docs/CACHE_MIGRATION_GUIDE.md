# 缓存服务迁移指南

## 概述

我们已经将 `UserCacheService` 和 `GlobalCacheService` 的功能整合到 `settingsStore` 中，使用 zustand 实现统一的缓存管理。

## 迁移步骤

### 1. 当前状态

- ✅ `settingsStore.ts` 已扩展，包含所有缓存功能
- ✅ 创建了兼容层，保持现有 API 不变
- ✅ 类型检查通过

### 2. 推荐的迁移方式

#### 直接使用 settingsStore（推荐）

```typescript
// 旧方式
import { UserCacheService } from '@/services/userCacheService'
import { GlobalCacheService } from '@/services/globalCacheService'

const user = await UserCacheService.getCurrentUser()
const cacheKey = GlobalCacheService.generateCacheKey('userProfile', userId)

// 新方式
import { useSettingsStore } from '@/store/settingsStore'

const user = await useSettingsStore.getState().getCurrentUser()
const cacheKey = useSettingsStore.getState().generateCacheKey('userProfile', userId)
```

#### 继续使用兼容层（临时）

现有代码可以继续工作，不需要立即修改：

```typescript
// 这些调用仍然有效，但会显示 @deprecated 警告
import { UserCacheService } from '@/services/userCacheService'
import { GlobalCacheService } from '@/services/globalCacheService'

const user = await UserCacheService.getCurrentUser()
```

### 3. 新功能对比

#### 用户缓存功能

| 原 UserCacheService | 新 settingsStore 方法 | 说明 |
|-------------------|---------------------|------|
| `getCurrentUser()` | `getCurrentUser()` | 获取当前用户（带缓存） |
| `clearCache()` | `clearUserCache()` | 清除用户缓存 |
| `updateCache(user)` | `updateUserCache(user)` | 更新缓存中的用户信息 |
| `forceRefresh()` | `forceRefreshUser()` | 强制刷新用户信息 |
| `getCacheStatus()` | `getUserCacheStatus()` | 获取缓存状态 |

#### 通用缓存功能

| 原 GlobalCacheService | 新 settingsStore 方法 | 说明 |
|---------------------|---------------------|------|
| `generateCacheKey(type, id)` | `generateCacheKey(type, id)` | 生成缓存键 |
| `get<T>(key)` | `getFromGlobalCache<T>(key)` | 获取缓存数据 |
| `set<T>(key, data)` | `setGlobalCache<T>(key, data)` | 设置缓存数据 |
| `setPromise<T>(key, promise)` | `setGlobalCachePromise<T>(key, promise)` | 设置Promise |
| `clear(key)` | `clearGlobalCache(key)` | 清除缓存 |
| `clearByType(type)` | `clearGlobalCacheByType(type)` | 按类型清除缓存 |
| `clearById(id)` | `clearGlobalCacheById(id)` | 按ID清除缓存 |
| `clearPromise(key)` | `clearGlobalCachePromise(key)` | 清除Promise引用 |
| `cacheSupabaseRequest<T>(url, fn)` | `cacheSupabaseRequest<T>(url, fn)` | 缓存Supabase请求 |
| `clearUrlCache(url)` | `clearUrlCache(url)` | 清除特定URL的缓存 |

### 4. 优势

1. **统一管理**: 所有缓存逻辑集中在一个地方
2. **类型安全**: 完整的 TypeScript 支持
3. **状态管理**: 利用 zustand 的响应式特性
4. **持久化控制**: 精确控制哪些数据需要持久化
5. **开发体验**: 更好的调试和状态追踪

### 5. 注意事项

1. **不持久化缓存数据**: 用户信息和缓存数据不会被持久化，确保安全性
2. **缓存时间**: 
   - 用户缓存: 5秒
   - 通用缓存: 30秒
3. **请求去重**: 自动处理并发请求，避免重复调用

### 6. 下一步计划

1. 逐步将现有代码迁移到直接使用 `settingsStore`
2. 移除兼容层文件
3. 清理不再使用的导入

## 测试

所有现有功能都应该继续正常工作。如果发现任何问题，请检查：

1. 导入路径是否正确
2. 方法名是否匹配新的 API
3. 类型定义是否正确

## 示例迁移

### userProfileService.ts 迁移示例

```typescript
// 旧代码
import { GlobalCacheService } from './globalCacheService'
import { UserCacheService } from './userCacheService'

const user = await UserCacheService.getCurrentUser()
const cacheKey = GlobalCacheService.generateCacheKey('userProfile', targetUserId)
const cached = GlobalCacheService.get<UserProfile>(cacheKey)

// 新代码
import { useSettingsStore } from '@/store/settingsStore'

const user = await useSettingsStore.getState().getCurrentUser()
const cacheKey = useSettingsStore.getState().generateCacheKey('userProfile', targetUserId)
const cached = useSettingsStore.getState().getFromGlobalCache<UserProfile>(cacheKey)
```