import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { 
  Shield, 
  Users, 
  Settings, 
  BarChart3, 
  Database, 
  HeadphonesIcon,
  CreditCard,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { 
  PERMISSION_GROUPS, 
  PERMISSION_DESCRIPTIONS,
  DANGEROUS_PERMISSIONS,
  PermissionHelper
} from '../../utils/adminPermissionConstants';
import { PermissionUtils } from '../../utils/adminMiddleware';

interface AdminPermissionManagerProps {
  permissions: Record<string, boolean>;
  onPermissionsChange: (permissions: Record<string, boolean>) => void;
  readOnly?: boolean;
  showValidation?: boolean;
}

// 权限分组图标映射
const PERMISSION_GROUP_ICONS = {
  BASE: Shield,
  USER: Users,
  ADMIN: Shield,
  ROLE: Settings,
  SYSTEM: Settings,
  ANALYTICS: BarChart3,
  DATA: Database,
  SUPPORT: HeadphonesIcon,
  SUBSCRIPTION: CreditCard,
  FINANCIAL: DollarSign,
};

export function AdminPermissionManager({
  permissions,
  onPermissionsChange,
  readOnly = false,
  showValidation = true
}: AdminPermissionManagerProps) {
  const [localPermissions, setLocalPermissions] = useState(permissions);
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>({ valid: true, errors: [], warnings: [] });

  // 同步外部权限变化
  useEffect(() => {
    setLocalPermissions(permissions);
  }, [permissions]);

  // 验证权限组合
  useEffect(() => {
    if (showValidation) {
      const validationResult = PermissionHelper.validatePermissions(localPermissions);
      setValidation(validationResult);
    }
  }, [localPermissions, showValidation]);

  // 处理权限变更
  const handlePermissionChange = (permission: string, enabled: boolean) => {
    if (readOnly) return;

    const newPermissions = { ...localPermissions, [permission]: enabled };
    
    // 如果启用了超级管理员权限，清除其他权限
    if (permission === 'super_admin' && enabled) {
      Object.keys(newPermissions).forEach(key => {
        if (key !== 'super_admin') {
          newPermissions[key] = false;
        }
      });
    }
    
    // 如果禁用了超级管理员权限，可能需要启用其他权限
    if (permission === 'super_admin' && !enabled) {
      // 这里可以添加默认权限逻辑
    }

    setLocalPermissions(newPermissions);
    onPermissionsChange(newPermissions);
  };

  // 处理权限组变更
  const handleGroupToggle = (groupName: string, enabled: boolean) => {
    if (readOnly) return;

    const groupPermissions = PERMISSION_GROUPS[groupName as keyof typeof PERMISSION_GROUPS];
    const newPermissions = { ...localPermissions };

    groupPermissions.forEach(permission => {
      newPermissions[permission] = enabled;
    });

    setLocalPermissions(newPermissions);
    onPermissionsChange(newPermissions);
  };

  // 检查权限组是否全部启用
  const isGroupEnabled = (groupName: string): boolean => {
    const groupPermissions = PERMISSION_GROUPS[groupName as keyof typeof PERMISSION_GROUPS];
    return groupPermissions.every(permission => localPermissions[permission] === true);
  };

  // 检查权限组是否部分启用
  const isGroupPartiallyEnabled = (groupName: string): boolean => {
    const groupPermissions = PERMISSION_GROUPS[groupName as keyof typeof PERMISSION_GROUPS];
    const enabledCount = groupPermissions.filter(permission => localPermissions[permission] === true).length;
    return enabledCount > 0 && enabledCount < groupPermissions.length;
  };

  // 渲染权限项
  const renderPermissionItem = (permission: string) => {
    const isEnabled = localPermissions[permission] === true;
    const isDangerous = DANGEROUS_PERMISSIONS.includes(permission as any);
    const description = PERMISSION_DESCRIPTIONS[permission] || permission;

    return (
      <div key={permission} className="flex items-center justify-between py-2">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {isDangerous && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm font-medium">{description}</span>
            {isDangerous && (
              <Badge variant="destructive" className="text-xs">
                危险
              </Badge>
            )}
          </div>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => handlePermissionChange(permission, checked)}
          disabled={readOnly || localPermissions.super_admin === true}
        />
      </div>
    );
  };

  // 渲染权限组
  const renderPermissionGroup = (groupName: string) => {
    const groupPermissions = PERMISSION_GROUPS[groupName as keyof typeof PERMISSION_GROUPS];
    const IconComponent = PERMISSION_GROUP_ICONS[groupName as keyof typeof PERMISSION_GROUP_ICONS];
    const isEnabled = isGroupEnabled(groupName);
    const isPartial = isGroupPartiallyEnabled(groupName);

    // 跳过空组
    if (groupPermissions.length === 0) return null;

    return (
      <Card key={groupName} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <IconComponent className="h-5 w-5" />
              <CardTitle className="text-base">
                {getGroupDisplayName(groupName)}
              </CardTitle>
              {isPartial && (
                <Badge variant="secondary" className="text-xs">
                  部分启用
                </Badge>
              )}
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => handleGroupToggle(groupName, checked)}
              disabled={readOnly || localPermissions.super_admin === true}
            />
          </div>
          <CardDescription>
            {getGroupDescription(groupName)}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1">
            {groupPermissions.map(renderPermissionItem)}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* 验证结果 */}
      {showValidation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="space-y-2">
          {validation.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">权限配置错误：</p>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.errors.map((error, index) => (
                      <li key={index} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {validation.warnings.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">权限配置警告：</p>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.warnings.map((warning, index) => (
                      <li key={index} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* 超级管理员权限特殊处理 */}
      {localPermissions.super_admin && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            已启用超级管理员权限，拥有系统所有权限。其他权限设置将被忽略。
          </AlertDescription>
        </Alert>
      )}

      {/* 权限组列表 */}
      <ScrollArea className="h-[600px]">
        <div className="space-y-4">
          {Object.keys(PERMISSION_GROUPS).map(renderPermissionGroup)}
        </div>
      </ScrollArea>

      {/* 权限统计 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">权限统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">已启用权限：</span>
              <span className="ml-2 font-medium">
                {Object.values(localPermissions).filter(Boolean).length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">总权限数：</span>
              <span className="ml-2 font-medium">
                {Object.keys(PERMISSION_DESCRIPTIONS).length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">危险权限：</span>
              <span className="ml-2 font-medium text-red-600">
                {DANGEROUS_PERMISSIONS.filter(p => localPermissions[p]).length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">配置状态：</span>
              <Badge 
                variant={validation.valid ? "default" : "destructive"}
                className="ml-2"
              >
                {validation.valid ? "有效" : "无效"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 获取权限组显示名称
function getGroupDisplayName(groupName: string): string {
  const displayNames: Record<string, string> = {
    BASE: '基础权限',
    USER: '用户管理',
    ADMIN: '管理员管理',
    ROLE: '角色管理',
    SYSTEM: '系统管理',
    ANALYTICS: '数据分析',
    DATA: '数据管理',
    SUPPORT: '客服支持',
    SUBSCRIPTION: '订阅管理',
    FINANCIAL: '财务管理',
  };
  
  return displayNames[groupName] || groupName;
}

// 获取权限组描述
function getGroupDescription(groupName: string): string {
  const descriptions: Record<string, string> = {
    BASE: '系统基础权限，包括超级管理员权限',
    USER: '用户账户的管理权限，包括查看、编辑、删除用户',
    ADMIN: '管理员账户的管理权限，包括创建、编辑管理员',
    ROLE: '角色和权限的管理权限',
    SYSTEM: '系统配置和维护相关权限',
    ANALYTICS: '数据分析和报告查看权限',
    DATA: '数据导入、导出和备份权限',
    SUPPORT: '客户支持和服务相关权限',
    SUBSCRIPTION: '订阅和计划管理权限',
    FINANCIAL: '财务数据和支付管理权限',
  };
  
  return descriptions[groupName] || '';
}