# 分类更新冲突检查功能

## 功能概述

在设置页面的Options -> Categories面板中，当用户尝试编辑现有分类时，系统会检查更新后的分类名称是否与系统默认分类或其他用户自定义分类冲突，并给出相应的提示。

## 更新逻辑确认

### 1. 基于ID的更新

分类更新操作确实是基于ID进行的：

```typescript
// 在 supabaseCategoriesService.ts 中
async updateCategory(id: string, updateData: { value?: string; label?: string }): Promise<CategoryOption> {
  // 使用ID进行更新
  const { data, error } = await supabase
    .from('categories')
    .update(updateData)
    .eq('id', id)  // 基于ID更新
    .eq('is_default', false) // 只能更新非默认分类
    .select('id, value, label, is_default')
    .single()
}
```

### 2. 更新流程

1. **UI层**：用户点击编辑按钮 → 打开EditDialog
2. **组件层**：`handleSaveEdit` → 调用 `editCategory(oldValue, newOption)`
3. **Store层**：通过`oldValue`查找分类ID → 调用服务层的`updateCategory(id, updateData)`
4. **服务层**：基于ID执行更新操作

## 冲突检查逻辑

### 1. 检查与系统默认分类的冲突

当用户尝试将分类更新为与系统默认分类相同的`value`时：
- **阻止更新**：不允许用户分类与系统默认分类同名
- **错误提示**：`无法更新分类：已存在同名的系统默认分类 "{默认分类名称}"`

### 2. 检查与其他用户自定义分类的冲突

当用户尝试将分类更新为与自己其他自定义分类相同的`value`时：
- **阻止更新**：不允许用户创建重复的自定义分类
- **错误提示**：`该分类已存在：您已经创建了名为 "{现有分类名称}" 的分类`
- **排除当前分类**：使用`.neq('id', id)`排除当前正在编辑的分类

### 3. 允许相同值更新

如果用户只是更新标签而保持相同的`value`，或者没有实际改变`value`，则允许更新。

## 实现细节

### 1. 后端检查（服务层）

**文件**: `src/services/supabaseCategoriesService.ts`

在`updateCategory`方法中添加了预检查逻辑：

```typescript
// 如果要更新value，需要检查冲突
if (updateData.value) {
  // 检查是否存在同名的系统默认分类
  const { data: existingDefault } = await supabase
    .from('categories')
    .select('id, value, label, is_default')
    .eq('value', updateData.value)
    .eq('is_default', true)
    .maybeSingle()

  if (existingDefault) {
    throw new Error(`无法更新分类：已存在同名的系统默认分类 "${existingDefault.label}"`)
  }

  // 检查是否存在同名的其他用户自定义分类（排除当前分类）
  const { data: existingUser } = await supabase
    .from('categories')
    .select('id, value, label, is_default')
    .eq('value', updateData.value)
    .eq('user_id', user.id)
    .eq('is_default', false)
    .neq('id', id) // 排除当前分类
    .maybeSingle()

  if (existingUser) {
    throw new Error(`该分类已存在：您已经创建了名为 "${existingUser.label}" 的分类`)
  }
}
```

### 2. 前端实时验证（UI层）

**文件**: `src/components/subscription/OptionsManager.tsx`

在`EditDialog`组件中添加了实时冲突检查：

```typescript
const checkConflict = (inputName: string) => {
  if (!inputName.trim() || inputName.trim() === currentLabel) return null
  
  const value = generateValue(inputName.trim())
  const items = title === 'Category' ? categories : paymentMethods
  
  // 检查是否与系统默认项目冲突
  const defaultItem = items.find(item => item.value === value && item.is_default)
  if (defaultItem) {
    return `与系统默认分类 "${defaultItem.label}" 冲突`
  }
  
  // 检查是否与其他用户自定义项目冲突（排除当前编辑的项目）
  const userItem = items.find(item => 
    item.value === value && 
    !item.is_default && 
    item.label !== currentLabel
  )
  if (userItem) {
    return `与现有分类 "${userItem.label}" 冲突`
  }
  
  return null
}
```

### 3. 用户体验改进

1. **实时反馈**：用户在编辑分类名称时，立即显示冲突提示
2. **视觉提示**：冲突时输入框边框变红，显示错误信息
3. **按钮状态**：有冲突或无变化时禁用"保存"按钮
4. **预览功能**：显示将要生成的新`value`值
5. **中文界面**：所有提示信息都使用中文
6. **变化检测**：只有当内容实际发生变化时才允许保存

## 用户界面

### 正常编辑状态
```
┌─────────────────────────────────┐
│ 编辑分类                          │
├─────────────────────────────────┤
│ 名称: [我的更新分类____________]    │
│ 将更新为: 我的-更新分类             │
│                                 │
│           [取消]  [保存更改]      │
└─────────────────────────────────┘
```

### 冲突状态
```
┌─────────────────────────────────┐
│ 编辑分类                          │
├─────────────────────────────────┤
│ 名称: [流媒体________________]    │ ← 红色边框
│ ❌ 与系统默认分类 "流媒体" 冲突     │ ← 红色错误信息
│                                 │
│           [取消]  [保存更改]      │ ← 按钮禁用
└─────────────────────────────────┘
```

### 无变化状态
```
┌─────────────────────────────────┐
│ 编辑分类                          │
├─────────────────────────────────┤
│ 名称: [原始分类名称____________]    │
│                                 │
│           [取消]  [保存更改]      │ ← 按钮禁用（无变化）
└─────────────────────────────────┘
```

## 安全措施

### 1. 权限控制

- **只能编辑用户自定义分类**：通过`.eq('is_default', false)`确保不能编辑系统默认分类
- **用户数据隔离**：通过RLS策略确保用户只能编辑自己的分类

### 2. 数据完整性

- **数据库约束**：`UNIQUE(user_id, value)`作为最后防线
- **事务安全**：更新操作是原子性的
- **错误处理**：详细的错误信息和回滚机制

## 测试验证

### 自动化测试

运行测试脚本验证更新冲突检查功能：

```bash
npx tsx scripts/test-category-update-conflict.ts
```

测试内容包括：
1. 创建测试分类
2. 测试正常更新
3. 测试与系统默认分类的冲突
4. 测试与其他用户分类的冲突
5. 测试相同值更新（应该成功）
6. 测试更新系统默认分类（应该失败）
7. 清理测试数据

### 手动测试

1. **访问设置页面**：http://localhost:5173/settings
2. **切换到Options -> Categories**
3. **点击分类的编辑按钮**
4. **测试各种冲突情况**：
   - 修改为与系统默认分类相同的名称
   - 修改为与其他用户分类相同的名称
   - 保持原名称不变
   - 修改为全新的名称

## 支付方式同步改进

为了保持一致性，支付方式的编辑功能也实现了相同的冲突检查逻辑：

**文件**: `src/services/supabasePaymentMethodsService.ts`

- 检查与系统默认支付方式的冲突
- 检查与其他用户自定义支付方式的冲突
- 排除当前编辑的支付方式
- 提供详细的错误信息

## 注意事项

1. **性能考虑**：前端检查基于已加载的分类列表，后端检查确保数据准确性
2. **用户体验**：实时反馈比提交后的错误提示更友好
3. **数据同步**：确保前端分类列表与后端数据保持同步
4. **错误处理**：提供清晰的中文错误信息

## 与添加功能的一致性

更新功能的冲突检查逻辑与添加功能保持一致：
- 相同的冲突检查规则
- 相同的错误信息格式
- 相同的用户界面设计
- 相同的实时验证机制

---

**实现时间**: 2025年8月3日  
**版本**: v1.1  
**影响范围**: 分类和支付方式的编辑功能