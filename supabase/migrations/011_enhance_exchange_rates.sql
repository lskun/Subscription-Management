-- =====================================================
-- 汇率系统增强迁移
-- 添加汇率历史记录和改进的访问控制
-- =====================================================

-- 添加汇率历史记录表
CREATE TABLE exchange_rate_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate DECIMAL(15, 8) NOT NULL,
    date DATE NOT NULL,
    source TEXT DEFAULT 'api' CHECK (source IN ('api', 'manual', 'system')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为汇率历史表创建索引
CREATE INDEX idx_exchange_rate_history_currencies ON exchange_rate_history(from_currency, to_currency);
CREATE INDEX idx_exchange_rate_history_date ON exchange_rate_history(date);
CREATE INDEX idx_exchange_rate_history_created_at ON exchange_rate_history(created_at);

-- 添加汇率更新日志表
CREATE TABLE exchange_rate_update_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    update_type TEXT NOT NULL CHECK (update_type IN ('scheduled', 'manual', 'api')),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
    rates_updated INTEGER DEFAULT 0,
    error_message TEXT,
    source TEXT DEFAULT 'system',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为更新日志表创建索引
CREATE INDEX idx_exchange_rate_update_logs_status ON exchange_rate_update_logs(status);
CREATE INDEX idx_exchange_rate_update_logs_created_at ON exchange_rate_update_logs(created_at);

-- 为现有汇率表添加新字段
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'api' CHECK (source IN ('api', 'manual', 'system'));
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 创建汇率更新触发器函数
CREATE OR REPLACE FUNCTION update_exchange_rate_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为汇率表添加更新时间戳触发器
DROP TRIGGER IF EXISTS trigger_update_exchange_rate_timestamp ON exchange_rates;
CREATE TRIGGER trigger_update_exchange_rate_timestamp
    BEFORE UPDATE ON exchange_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_exchange_rate_timestamp();

-- 创建汇率历史记录触发器函数
CREATE OR REPLACE FUNCTION log_exchange_rate_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- 当汇率更新时，将旧值记录到历史表
    IF TG_OP = 'UPDATE' AND OLD.rate != NEW.rate THEN
        INSERT INTO exchange_rate_history (
            from_currency, 
            to_currency, 
            rate, 
            date, 
            source,
            created_at
        ) VALUES (
            OLD.from_currency,
            OLD.to_currency,
            OLD.rate,
            OLD.date,
            OLD.source,
            OLD.updated_at
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 为汇率表添加历史记录触发器
DROP TRIGGER IF EXISTS trigger_log_exchange_rate_changes ON exchange_rates;
CREATE TRIGGER trigger_log_exchange_rate_changes
    AFTER UPDATE ON exchange_rates
    FOR EACH ROW
    EXECUTE FUNCTION log_exchange_rate_changes();

-- 汇率相关表的RLS策略
-- 汇率数据是全局共享的，所有认证用户都可以读取
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rate_update_logs ENABLE ROW LEVEL SECURITY;

-- 汇率表的读取策略 - 所有认证用户可读
CREATE POLICY "所有认证用户可以读取汇率数据"
ON exchange_rates FOR SELECT
TO authenticated
USING (true);

-- 汇率历史表的读取策略 - 所有认证用户可读
CREATE POLICY "所有认证用户可以读取汇率历史"
ON exchange_rate_history FOR SELECT
TO authenticated
USING (true);

-- 汇率更新日志的读取策略 - 所有认证用户可读
CREATE POLICY "所有认证用户可以读取汇率更新日志"
ON exchange_rate_update_logs FOR SELECT
TO authenticated
USING (true);

-- 只有系统服务可以写入汇率数据（通过Edge Functions）
CREATE POLICY "只有服务角色可以修改汇率数据"
ON exchange_rates FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "只有服务角色可以写入汇率历史"
ON exchange_rate_history FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "只有服务角色可以写入更新日志"
ON exchange_rate_update_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 创建汇率管理的辅助函数
CREATE OR REPLACE FUNCTION get_latest_exchange_rate(
    p_from_currency TEXT,
    p_to_currency TEXT
) RETURNS DECIMAL(15, 8) AS $$
DECLARE
    latest_rate DECIMAL(15, 8);
BEGIN
    -- 获取最新汇率
    SELECT rate INTO latest_rate
    FROM exchange_rates
    WHERE from_currency = UPPER(p_from_currency)
      AND to_currency = UPPER(p_to_currency)
      AND date = (
          SELECT MAX(date)
          FROM exchange_rates
          WHERE from_currency = UPPER(p_from_currency)
            AND to_currency = UPPER(p_to_currency)
      );
    
    -- 如果没有找到直接汇率，尝试反向汇率
    IF latest_rate IS NULL THEN
        SELECT 1.0 / rate INTO latest_rate
        FROM exchange_rates
        WHERE from_currency = UPPER(p_to_currency)
          AND to_currency = UPPER(p_from_currency)
          AND date = (
              SELECT MAX(date)
              FROM exchange_rates
              WHERE from_currency = UPPER(p_to_currency)
                AND to_currency = UPPER(p_from_currency)
          );
    END IF;
    
    -- 如果还是没有找到，返回1.0（相同货币或默认值）
    RETURN COALESCE(latest_rate, 1.0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建汇率统计函数
CREATE OR REPLACE FUNCTION get_exchange_rate_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_rates', (SELECT COUNT(*) FROM exchange_rates),
        'latest_update', (SELECT MAX(updated_at) FROM exchange_rates),
        'supported_currencies', (
            SELECT json_agg(DISTINCT to_currency ORDER BY to_currency)
            FROM exchange_rates
            WHERE from_currency = 'CNY'
        ),
        'last_successful_update', (
            SELECT MAX(completed_at)
            FROM exchange_rate_update_logs
            WHERE status = 'success'
        ),
        'failed_updates_today', (
            SELECT COUNT(*)
            FROM exchange_rate_update_logs
            WHERE status = 'failed'
              AND DATE(created_at) = CURRENT_DATE
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予必要的权限
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON exchange_rates TO authenticated;
GRANT SELECT ON exchange_rate_history TO authenticated;
GRANT SELECT ON exchange_rate_update_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_latest_exchange_rate(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_exchange_rate_stats() TO authenticated;

-- 为service_role授予完整权限
GRANT ALL ON exchange_rates TO service_role;
GRANT ALL ON exchange_rate_history TO service_role;
GRANT ALL ON exchange_rate_update_logs TO service_role;