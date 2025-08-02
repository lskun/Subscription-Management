-- =====================================================
-- 用户配额使用记录表
-- =====================================================

-- 创建配额使用记录表
CREATE TABLE user_quota_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quota_type TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 1,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用RLS
ALTER TABLE user_quota_usage ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "用户只能查看自己的配额使用记录"
ON user_quota_usage FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "用户只能插入自己的配额使用记录"
ON user_quota_usage FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 系统可以插入任何用户的配额使用记录（用于自动记录）
CREATE POLICY "系统可以插入配额使用记录"
ON user_quota_usage FOR INSERT
TO service_role
WITH CHECK (true);

-- 创建索引以优化查询性能
CREATE INDEX idx_user_quota_usage_user_id ON user_quota_usage(user_id);
CREATE INDEX idx_user_quota_usage_quota_type ON user_quota_usage(quota_type);
CREATE INDEX idx_user_quota_usage_recorded_at ON user_quota_usage(recorded_at);
CREATE INDEX idx_user_quota_usage_user_type_date ON user_quota_usage(user_id, quota_type, recorded_at);

-- 创建用于查询配额使用情况的函数
CREATE OR REPLACE FUNCTION get_quota_usage(
    p_user_id UUID,
    p_quota_type TEXT,
    p_period_start TIMESTAMPTZ DEFAULT NULL,
    p_period_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    usage_count INTEGER;
BEGIN
    -- 如果没有指定时间范围，使用默认范围
    IF p_period_start IS NULL THEN
        CASE p_quota_type
            WHEN 'api_calls_per_hour' THEN
                p_period_start := DATE_TRUNC('hour', NOW());
            WHEN 'api_calls_per_day' THEN
                p_period_start := DATE_TRUNC('day', NOW());
            WHEN 'export_per_month', 'import_per_month' THEN
                p_period_start := DATE_TRUNC('month', NOW());
            ELSE
                p_period_start := '1970-01-01'::TIMESTAMPTZ;
        END CASE;
    END IF;
    
    IF p_period_end IS NULL THEN
        p_period_end := NOW();
    END IF;
    
    -- 查询使用量
    SELECT COALESCE(SUM(amount), 0)
    INTO usage_count
    FROM user_quota_usage
    WHERE user_id = p_user_id
      AND quota_type = p_quota_type
      AND recorded_at >= p_period_start
      AND recorded_at <= p_period_end;
    
    RETURN usage_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION get_quota_usage(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- 创建记录配额使用的函数
CREATE OR REPLACE FUNCTION record_quota_usage(
    p_user_id UUID,
    p_quota_type TEXT,
    p_amount INTEGER DEFAULT 1,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO user_quota_usage (user_id, quota_type, amount, metadata)
    VALUES (p_user_id, p_quota_type, p_amount, p_metadata);
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION record_quota_usage(UUID, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION record_quota_usage(UUID, TEXT, INTEGER, JSONB) TO service_role;

-- 创建检查配额限制的函数
CREATE OR REPLACE FUNCTION check_quota_limit(
    p_user_id UUID,
    p_quota_type TEXT,
    p_requested_amount INTEGER DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
    current_usage INTEGER;
    quota_limit INTEGER;
    user_plan RECORD;
    result JSON;
BEGIN
    -- 获取用户订阅计划
    SELECT sp.limits
    INTO user_plan
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', '用户订阅计划不存在',
            'current_usage', 0,
            'limit', 0
        );
    END IF;
    
    -- 获取配额限制
    quota_limit := COALESCE((user_plan.limits ->> p_quota_type)::INTEGER, -1);
    
    -- -1 表示无限制
    IF quota_limit = -1 THEN
        RETURN json_build_object(
            'allowed', true,
            'reason', '无限制',
            'current_usage', 0,
            'limit', -1
        );
    END IF;
    
    -- 获取当前使用量
    current_usage := get_quota_usage(p_user_id, p_quota_type);
    
    -- 检查是否超过限制
    IF current_usage + p_requested_amount > quota_limit THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', '超过配额限制',
            'current_usage', current_usage,
            'limit', quota_limit,
            'requested', p_requested_amount
        );
    END IF;
    
    RETURN json_build_object(
        'allowed', true,
        'reason', '在配额范围内',
        'current_usage', current_usage,
        'limit', quota_limit,
        'requested', p_requested_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION check_quota_limit(UUID, TEXT, INTEGER) TO authenticated;

-- 创建清理过期配额记录的函数（用于定期清理）
CREATE OR REPLACE FUNCTION cleanup_quota_usage_records()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 删除超过6个月的记录
    DELETE FROM user_quota_usage
    WHERE recorded_at < NOW() - INTERVAL '6 months';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION cleanup_quota_usage_records() TO service_role;