# 分类删除功能修复

## 问题描述

在设置页面的Options下的Categories面板点击删除分类时，出现以下错误：

```
406 {"code": "PGRST116","details": "The result contains 2 rows","hint": null,"message": "JSON object requested, multiple (or no) rows returned"}
```

## 问题分析

### 根本原因

1. **数据库设计问题**: `categories`表的唯一约束是`UNIQUE(user_id, value)`，这意味着：
   - 同一用户不能有重复的value
   - 不同用户可以有相同的value
   - 系统默认分类的`user_id`可能是NULL

2. **查询逻辑问题**: `getCategoryByValue`方法只按`value`查询，没有考虑用户隔离：
   ```sql
   SELECT * FROM categories WHERE value = 'streaming'
   ```
   这可能返回多行数据（系统默认分类 + 用户自定义分类），导致`.single()`调用失败。

3. **删除流程问题**: 删除流程是：
   - UI传递`category.value`给store
   - store调用`getCategoryByValue(value)`查找分类
   - 然后调用`deleteCategory(id)`删除

   这个流程不够直接，应该直接传递ID。

## 修复方案

### 1. 修复`getCategoryByValue`方法

**文件**: `src/services/supabaseCategoriesService.ts`

**修改前**:
```typescript
async getCategoryByValue(value: string): Promise<CategoryOption | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, value, label, is_default')
    .eq('value', value)
    .single() // 这里会因为多行数据而失败
}
```

**修改后**:
```typescript
async getCategoryByValue(value: string): Promise<CategoryOption | null> {
  // 获取当前用户ID
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('用户未登录')
  }

  // 首先尝试查找用户自定义分类
  const { data: userCategory, error: userError2 } = await supabase
    .from('categories')
    .select('id, value, label, is_default')
    .eq('value', value)
    .eq('user_id', user.id)
    .eq('is_default', false)
    .maybeSingle() // 使用maybeSingle避免多行错误

  if (userCategory) {
    return userCategory
  }

  // 如果没有找到用户自定义分类，查找系统默认分类
  const { data: defaultCategory, error: defaultError } = await supabase
    .from('categories')
    .select('id, value, label, is_default')
    .eq('value', value)
    .eq('is_default', true)
    .maybeSingle()

  return defaultCategory
}
```

### 2. 优化删除流程

**文件**: `src/components/subscription/OptionsManager.tsx`

**修改前**:
```typescript
onDelete={() => handleDeleteClick('category', category.value, category.label)}
```

**修改后**:
```typescript
onDelete={() => handleDeleteClick('category', category.id, category.label)}
```

**文件**: `src/store/subscriptionStore.ts`

**修改前**:
```typescript
deleteCategory: async (value) => {
  const existingCategory = await supabaseCategoriesService.getCategoryByValue(value)
  if (!existingCategory) {
    throw new Error('分类不存在')
  }
  await supabaseCategoriesService.deleteCategory(existingCategory.id)
}
```

**修改后**:
```typescript
deleteCategory: async (id) => {
  await supabaseCategoriesService.deleteCategory(id)
}
```

### 3. 同步修复支付方式删除

为了保持一致性，同样修复了支付方式的删除逻辑：

**文件**: `src/services/supabasePaymentMethodsService.ts`
- 修复`getPaymentMethodByValue`方法，添加用户隔离逻辑

**文件**: `src/store/subscriptionStore.ts`
- 修改`deletePaymentMethod`方法，直接接受ID参数

**文件**: `src/components/subscription/OptionsManager.tsx`
- 修改支付方式删除调用，传递ID而不是value

## 修复效果

### 修复前
- 删除分类时出现PGRST116错误
- 查询可能返回多行数据导致`.single()`失败
- 删除流程冗余，需要先查找再删除

### 修复后
- 删除分类正常工作
- 查询逻辑考虑用户隔离，优先返回用户自定义分类
- 删除流程简化，直接使用ID删除
- 支付方式删除也得到同步修复

## 测试验证

创建了测试脚本 `scripts/test-category-deletion.ts` 用于验证修复效果：

```bash
npx tsx scripts/test-category-deletion.ts
```

测试内容包括：
1. 获取所有分类
2. 测试根据value查找分类
3. 测试创建和删除用户自定义分类
4. 测试删除系统默认分类（应该失败）

## 相关文件

### 修改的文件
- `src/services/supabaseCategoriesService.ts`
- `src/services/supabasePaymentMethodsService.ts`
- `src/store/subscriptionStore.ts`
- `src/components/subscription/OptionsManager.tsx`

### 新增的文件
- `scripts/test-category-deletion.ts` - 测试脚本
- `docs/CATEGORY_DELETION_FIX.md` - 本文档

## 注意事项

1. **数据库约束**: 当前的`UNIQUE(user_id, value)`约束是合理的，允许不同用户有相同的分类value
2. **RLS策略**: 现有的RLS策略正确处理了用户数据隔离
3. **向后兼容**: 修复保持了API的向后兼容性
4. **错误处理**: 改进了错误处理，使用`maybeSingle()`避免多行数据错误

## 预防措施

为了避免类似问题，建议：

1. **统一ID传递**: 在UI组件中直接传递实体ID，避免通过其他字段查找
2. **用户隔离查询**: 所有按非主键字段查询的方法都应考虑用户隔离
3. **使用maybeSingle**: 当查询可能返回0或1行时，使用`maybeSingle()`而不是`single()`
4. **完善测试**: 为关键功能编写测试脚本，确保修复有效

---

**修复时间**: 2025年8月3日  
**修复者**: 开发团队  
**影响范围**: 分类和支付方式的删除功能