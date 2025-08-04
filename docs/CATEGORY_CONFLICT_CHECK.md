# 分类添加冲突检查功能

## 功能概述

在设置页面的Options -> Categories面板中，当用户尝试添加新分类时，系统会检查是否与现有分类冲突，并给出相应的提示。

## 冲突检查逻辑

### 1. 检查与系统默认分类的冲突

当用户尝试创建的分类与系统默认分类的`value`相同时：
- **阻止创建**：不允许用户创建与系统默认分类同名的自定义分类
- **错误提示**：`无法创建分类：已存在同名的系统默认分类 "{默认分类名称}"`

### 2. 检查与用户自定义分类的冲突

当用户尝试创建的分类与自己已有的自定义分类的`value`相同时：
- **阻止创建**：不允许用户创建重复的自定义分类
- **错误提示**：`该分类已存在：您已经创建了名为 "{现有分类名称}" 的分类`

### 3. Value生成规则

分类的`value`是根据用户输入的`label`自动生成的：
```javascript
function generateValue(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // 移除特殊字符
    .replace(/\s+/g, '-') // 空格替换为连字符
    .trim()
}
```

例如：
- "流媒体服务" → "流媒体服务" → "流媒体-服务"
- "Cloud Storage!" → "cloud-storage"
- "My Category" → "my-category"

## 实现细节

### 1. 后端检查（服务层）

**文件**: `src/services/supabaseCategoriesService.ts`

在`createCategory`方法中添加了预检查逻辑：

```typescript
// 检查是否存在同名的系统默认分类
const { data: existingDefault } = await supabase
  .from('categories')
  .select('id, value, label, is_default')
  .eq('value', categoryData.value)
  .eq('is_default', true)
  .maybeSingle()

if (existingDefault) {
  throw new Error(`无法创建分类：已存在同名的系统默认分类 "${existingDefault.label}"`)
}

// 检查是否存在同名的用户自定义分类
const { data: existingUser } = await supabase
  .from('categories')
  .select('id, value, label, is_default')
  .eq('value', categoryData.value)
  .eq('user_id', user.id)
  .eq('is_default', false)
  .maybeSingle()

if (existingUser) {
  throw new Error(`该分类已存在：您已经创建了名为 "${existingUser.label}" 的分类`)
}
```

### 2. 前端实时验证（UI层）

**文件**: `src/components/subscription/OptionsManager.tsx`

在`AddDialog`组件中添加了实时冲突检查：

```typescript
const checkConflict = (inputName: string) => {
  if (!inputName.trim()) return null
  
  const value = generateValue(inputName.trim())
  const items = title === 'Category' ? categories : paymentMethods
  
  // 检查是否与系统默认项目冲突
  const defaultItem = items.find(item => item.value === value && item.is_default)
  if (defaultItem) {
    return `与系统默认分类 "${defaultItem.label}" 冲突`
  }
  
  // 检查是否与用户自定义项目冲突
  const userItem = items.find(item => item.value === value && !item.is_default)
  if (userItem) {
    return `与现有分类 "${userItem.label}" 冲突`
  }
  
  return null
}
```

### 3. 用户体验改进

1. **实时反馈**：用户在输入分类名称时，立即显示冲突提示
2. **视觉提示**：冲突时输入框边框变红，显示错误信息
3. **按钮状态**：有冲突时禁用"添加"按钮
4. **预览功能**：显示将要生成的`value`值
5. **中文界面**：所有提示信息都使用中文

## 用户界面

### 正常状态
```
┌─────────────────────────────────┐
│ 添加新分类                        │
├─────────────────────────────────┤
│ 名称: [我的新分类____________]    │
│ 将创建为: 我的-新分类              │
│                                 │
│           [取消]  [添加分类]      │
└─────────────────────────────────┘
```

### 冲突状态
```
┌─────────────────────────────────┐
│ 添加新分类                        │
├─────────────────────────────────┤
│ 名称: [流媒体________________]    │ ← 红色边框
│ ❌ 与系统默认分类 "流媒体" 冲突     │ ← 红色错误信息
│                                 │
│           [取消]  [添加分类]      │ ← 按钮禁用
└─────────────────────────────────┘
```

## 测试验证

### 自动化测试

运行测试脚本验证冲突检查功能：

```bash
npx tsx scripts/test-category-conflict.ts
```

测试内容包括：
1. 获取现有分类列表
2. 尝试创建与系统默认分类冲突的分类
3. 创建新分类并测试重复创建
4. 测试特殊字符和边界情况
5. 清理测试数据

### 手动测试

1. **访问设置页面**：http://localhost:5173/settings
2. **切换到Options标签页**
3. **点击"Add Category"按钮**
4. **测试冲突情况**：
   - 输入与系统默认分类相同的名称（如"流媒体"）
   - 输入与现有用户分类相同的名称
   - 观察实时反馈和错误提示

## 支付方式同步改进

为了保持一致性，支付方式的添加功能也实现了相同的冲突检查逻辑：

**文件**: `src/services/supabasePaymentMethodsService.ts`

- 检查与系统默认支付方式的冲突
- 检查与用户自定义支付方式的冲突
- 提供详细的错误信息

## 数据库约束

现有的数据库约束 `UNIQUE(user_id, value)` 作为最后一道防线：
- 确保同一用户不能创建重复的分类
- 系统默认分类的`user_id`为NULL，不受此约束影响
- 如果前端检查失效，数据库约束会阻止重复数据

## 错误处理层级

1. **前端实时验证**：用户输入时立即检查，提供最佳用户体验
2. **后端预检查**：创建前检查，提供详细错误信息
3. **数据库约束**：最后防线，确保数据完整性

## 注意事项

1. **性能考虑**：前端检查基于已加载的分类列表，不会产生额外的网络请求
2. **数据同步**：确保前端分类列表与后端数据保持同步
3. **国际化**：错误信息支持中文显示
4. **可扩展性**：检查逻辑可以轻松扩展到其他类型的选项

---

**实现时间**: 2025年8月3日  
**版本**: v1.0  
**影响范围**: 分类和支付方式的添加功能