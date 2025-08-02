-- 管理员系统数据库结构
-- 创建管理员角色表
CREATE TABLE admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建管理员用户表
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES admin_roles(id),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 创建管理员操作日志表
CREATE TABLE admin_operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id),
    operation_type TEXT NOT NULL,
    target_type TEXT NOT NULL, -- 'user', 'subscription', 'system' etc.
    target_id TEXT,
    operation_details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建管理员会话表
CREATE TABLE admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id),
    session_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用RLS
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- 创建管理员权限检查函数
CREATE OR REPLACE FUNCTION is_admin_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM admin_users au
        JOIN admin_roles ar ON au.role_id = ar.id
        WHERE au.user_id = user_uuid 
        AND au.is_active = true 
        AND ar.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建管理员权限检查函数（带权限验证）
CREATE OR REPLACE FUNCTION has_admin_permission(user_uuid UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_permissions JSONB;
BEGIN
    SELECT ar.permissions INTO user_permissions
    FROM admin_users au
    JOIN admin_roles ar ON au.role_id = ar.id
    WHERE au.user_id = user_uuid 
    AND au.is_active = true 
    AND ar.is_active = true;
    
    IF user_permissions IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- 检查是否有超级管理员权限
    IF user_permissions ? 'super_admin' AND (user_permissions->>'super_admin')::boolean = true THEN
        RETURN TRUE;
    END IF;
    
    -- 检查具体权限
    RETURN user_permissions ? permission_name AND (user_permissions->>permission_name)::boolean = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS策略 - 只有管理员可以访问管理员相关表
CREATE POLICY "只有管理员可以查看角色"
ON admin_roles FOR SELECT
TO authenticated
USING (is_admin_user(auth.uid()));

CREATE POLICY "只有超级管理员可以管理角色"
ON admin_roles FOR ALL
TO authenticated
USING (has_admin_permission(auth.uid(), 'manage_roles'))
WITH CHECK (has_admin_permission(auth.uid(), 'manage_roles'));

CREATE POLICY "只有管理员可以查看管理员用户"
ON admin_users FOR SELECT
TO authenticated
USING (is_admin_user(auth.uid()));

CREATE POLICY "只有超级管理员可以管理管理员用户"
ON admin_users FOR ALL
TO authenticated
USING (has_admin_permission(auth.uid(), 'manage_admins'))
WITH CHECK (has_admin_permission(auth.uid(), 'manage_admins'));

CREATE POLICY "管理员可以查看操作日志"
ON admin_operation_logs FOR SELECT
TO authenticated
USING (is_admin_user(auth.uid()));

CREATE POLICY "管理员可以创建操作日志"
ON admin_operation_logs FOR INSERT
TO authenticated
WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "管理员可以查看自己的会话"
ON admin_sessions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users au 
        WHERE au.id = admin_user_id AND au.user_id = auth.uid()
    )
);

CREATE POLICY "管理员可以管理自己的会话"
ON admin_sessions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users au 
        WHERE au.id = admin_user_id AND au.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users au 
        WHERE au.id = admin_user_id AND au.user_id = auth.uid()
    )
);

-- 插入默认管理员角色
INSERT INTO admin_roles (name, description, permissions) VALUES
('super_admin', '超级管理员', '{"super_admin": true, "manage_users": true, "manage_admins": true, "manage_roles": true, "view_analytics": true, "manage_system": true}'),
('admin', '普通管理员', '{"manage_users": true, "view_analytics": true}'),
('support', '客服人员', '{"view_users": true, "manage_user_support": true}');

-- 创建索引
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_role_id ON admin_users(role_id);
CREATE INDEX idx_admin_operation_logs_admin_user_id ON admin_operation_logs(admin_user_id);
CREATE INDEX idx_admin_operation_logs_created_at ON admin_operation_logs(created_at);
CREATE INDEX idx_admin_sessions_admin_user_id ON admin_sessions(admin_user_id);
CREATE INDEX idx_admin_sessions_session_token ON admin_sessions(session_token);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);