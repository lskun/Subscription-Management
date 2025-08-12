# 分类编辑主键约束错误修复

## 问题描述

用户在编辑分类时遇到以下错误：
- 错误代码：`23505`
- 错误信息：`duplicate key value violates unique constraint "categories_pkey"`
- 请求URL：`/rest/v1/categories?id=eq.995943ac-87a7-497d-bc7f-2bfc78f6cbee&is_default=eq.false&select=id%2Cvalue%2Clabel%2Cis_default`

## 问题分析

### 错误原因
1. 在`subscriptionStore.ts`的`editCategory`方法中，存在不必要的查询逻辑
2. 组件传递了包含正确ID的分类对象，但store忽略了这个ID
3. store重新通过`getCategoryByValue(oldValue)`查找分类ID
4. 这种查询可能触发了数据库约束问题

### 问题流程
```
OptionsManager.handleSaveEdit()
  ↓
editCategory(oldValue, newOption) // newOption包含正确的ID
  ↓
getCategoryByValue(oldValue) // 不必要的查询
  ↓
updateCategory(existingCategory.id, newCategory)
```

## 修复方案

### 修改内容
修改`src/store/subscriptionStore.ts`中的`editCategory`方法：

```typescript
// 修复前
editCategory: async (oldValue, newCategory) => {
  const existingCategory = await supabaseCategoriesService.getCategoryByValue(oldValue)
  if (!existingCategory) {
    throw new Error('分类不存在')
  }
  await supabaseCategoriesService.updateCategory(existingCategory.id, newCategory)
}

// 修复后
editCategory: async (oldValue, newCategory) => {
  // 如果newCategory包含ID，直接使用ID进行更新
  if (newCategory.id) {
    await supabaseCategoriesService.updateCategory(newCategory.id, {
      value: newCategory.value,
      label: newCategory.label
    })
  } else {
    // 兼容旧的调用方式：通过value查找ID
    const existingCategory = await supabaseCategoriesService.getCategoryByValue(oldValue)
    if (!existingCategory) {
      throw new Error('分类不存在')
    }
    await supabaseCategoriesService.updateCategory(existingCategory.id, newCategory)
  }
}
```

### 修复优势
1. **避免不必要的查询**：直接使用传递的ID，减少数据库查询
2. **提高性能**：减少网络请求和数据库负载
3. **增强稳定性**：避免`getCategoryByValue`可能引起的约束问题
4. **保持兼容性**：支持旧的调用方式

## 测试验证

创建了测试脚本`scripts/test-category-edit-fix.ts`来验证修复效果：

```bash
npx tsx scripts/test-category-edit-fix.ts
```

### 测试内容
1. 获取现有用户分类
2. 执行分类编辑操作
3. 验证更新结果
4. 恢复原始值

## 相关文件

- `src/store/subscriptionStore.ts` - 修复editCategory方法
- `src/components/subscription/OptionsManager.tsx` - 分类编辑UI组件
- `src/services/supabaseCategoriesService.ts` - 分类服务层
- `scripts/test-category-edit-fix.ts` - 测试脚本

## 预防措施

1. **直接使用ID**：当组件已经有ID时，避免重新查询
2. **减少查询链**：简化数据流，减少中间查询步骤
3. **错误处理**：提供更清晰的错误信息
4. **测试覆盖**：为编辑操作添加自动化测试

## 总结

这个修复解决了分类编辑时的主键约束错误，通过优化数据流和减少不必要的查询，提高了系统的稳定性和性能。修复保持了向后兼容性，不会影响现有功能。