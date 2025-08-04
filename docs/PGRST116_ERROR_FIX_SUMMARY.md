# PGRST116错误修复总结

## 问题描述

用户在设置页面编辑分类时遇到以下错误：
- **错误代码**: PGRST116
- **错误信息**: "JSON object requested, multiple (or no) rows returned"
- **用户看到的错误**: "更新分类失败: JSON object requested, multiple (or no) rows returned"

## 问题分析

### 根本原因
通过Playwright MCP工具的实际测试，发现问题出现在`src/services/supabaseCategoriesService.ts`的`updateCategory`方法中：

```typescript
// 问题代码
const { data, error } = await supabase
  .from('categories')
  .update(updateData)
  .eq('id', id)
  .eq('is_default', false) // 这里是问题所在
  .select('id, value, label, is_default')
  .single()
```

### 问题分析
1. **错误的查询条件**: 代码添加了`.eq('is_default', false)`条件，意图是"只能更新非默认分类"
2. **数据不匹配**: 如果用户试图编辑的分类实际上是系统默认分类（`is_default = true`），查询就不会找到任何记录
3. **`.single()`期望**: 由于使用了`.single()`方法，Supabase期望返回恰好一条记录，但实际返回了0条记录
4. **PGRST116错误**: 这导致了"JSON object requested, multiple (or no) rows returned"错误

### 网络请求分析
**修复前的失败请求**:
```
[PATCH] https://fbngjaewlcwnwrfqwygk.supabase.co/rest/v1/categories?id=eq.5413192d-29a1-42af-8c17-6088a6b81ab3&is_default=eq.false&select=id%2Cvalue%2Clabel%2Cis_default => [406]
```

**修复后的成功请求**:
```
[GET] https://fbngjaewlcwnwrfqwygk.supabase.co/rest/v1/categories?select=id%2Cvalue%2Clabel%2Cis_default%2Cuser_id&id=eq.5413192d-29a1-42af-8c17-6088a6b81ab3 => [200]
```

## 修复方案

### 修复代码
修改了`updateCategory`方法，采用"先检查后更新"的策略：

```typescript
// 修复后的代码
// 首先检查分类是否存在以及是否为用户自定义分类
const { data: existingCategory, error: checkError } = await supabase
  .from('categories')
  .select('id, value, label, is_default, user_id')
  .eq('id', id)
  .single()

if (checkError) {
  console.error('Error checking category:', checkError)
  if (checkError.code === 'PGRST116') {
    throw new Error('分类不存在')
  }
  throw new Error(`检查分类失败: ${checkError.message}`)
}

// 检查是否为系统默认分类
if (existingCategory.is_default) {
  throw new Error('无法编辑系统默认分类')
}

// 检查是否为当前用户的分类
if (existingCategory.user_id !== user.id) {
  throw new Error('无权限编辑此分类')
}

// 执行更新操作（移除了is_default条件）
const { data, error } = await supabase
  .from('categories')
  .update(updateData)
  .eq('id', id)
  .select('id, value, label, is_default')
  .single()
```

### 修复优势
1. **提前验证**: 在执行更新前先验证分类的状态和权限
2. **友好错误**: 提供清晰的中文错误消息，而不是技术性的PGRST116错误
3. **权限控制**: 确保用户只能编辑自己的分类
4. **避免无效请求**: 防止向数据库发送注定失败的更新请求

## 测试验证

### 测试场景1: 编辑系统默认分类
- **操作**: 尝试编辑系统默认的"云服务"分类
- **预期结果**: 显示"无法编辑系统默认分类"错误
- **实际结果**: ✅ 成功显示友好错误消息，不再出现PGRST116错误

### 测试场景2: 编辑用户自定义分类
- **操作**: 编辑用户自定义的"开发工具"分类为"开发工具集"
- **预期结果**: 成功更新分类名称
- **实际结果**: ✅ 分类成功更新，页面显示新名称

### 网络请求对比
| 修复前 | 修复后 |
|--------|--------|
| 直接发送PATCH请求 | 先发送GET请求验证 |
| 返回406错误 | 返回200成功 |
| 显示技术错误信息 | 显示友好错误信息 |

## 相关文件

- **主要修复文件**: `src/services/supabaseCategoriesService.ts`
- **UI组件**: `src/components/subscription/OptionsManager.tsx`
- **状态管理**: `src/store/subscriptionStore.ts`
- **测试文档**: `docs/CATEGORY_EDIT_TEST_GUIDE.md`

## 预防措施

1. **数据验证**: 在执行数据库操作前进行充分的数据验证
2. **权限检查**: 确保用户只能操作自己有权限的数据
3. **错误处理**: 提供用户友好的错误消息
4. **测试覆盖**: 为边界情况添加测试用例

## 总结

这个修复解决了用户在编辑分类时遇到的PGRST116错误，通过改进数据验证逻辑和错误处理，提供了更好的用户体验。修复后的代码更加健壮，能够正确处理各种边界情况，并提供清晰的错误反馈。

**修复效果**:
- ✅ 解决了PGRST116错误
- ✅ 提供友好的错误消息
- ✅ 保持正常编辑功能
- ✅ 增强了权限控制
- ✅ 提高了代码健壮性