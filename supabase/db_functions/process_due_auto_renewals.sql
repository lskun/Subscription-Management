

-- 批量处理到期的自动续费订阅
-- 该函数调用 process_subscription_renewal 函数来处理每个订阅的续费
-- 包含完整的批处理日志记录和错误处理机制
-- Version: 2.0 (使用 process_subscription_renewal 函数)

-- 删除现有函数（如果存在）
DROP FUNCTION IF EXISTS process_due_auto_renewals(INTEGER, UUID);

-- 创建批量自动续费处理函数
CREATE OR REPLACE FUNCTION process_due_auto_renewals(
    p_limit INTEGER DEFAULT 50,
    p_scheduler_run_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subscription RECORD;
    v_processed INTEGER := 0;
    v_errors INTEGER := 0;
    v_skipped INTEGER := 0;
    v_result jsonb;
    v_error_msg TEXT;
    v_start_time TIMESTAMP WITH TIME ZONE := NOW();
    v_batch_id UUID := gen_random_uuid();
    v_scheduler_run_id UUID;
BEGIN
    -- 优先使用直接传递的参数，否则尝试从会话变量获取
    v_scheduler_run_id := COALESCE(
        p_scheduler_run_id,
        CASE 
            WHEN current_setting('app.scheduler_run_id', true) != '' 
            THEN current_setting('app.scheduler_run_id', true)::UUID 
            ELSE NULL 
        END
    );
    
    -- 记录批次开始
    INSERT INTO auto_renew_subscriptions_logs (
        id, 
        scheduler_run_id,
        batch_size, 
        status, 
        started_at, 
        metadata
    ) VALUES (
        v_batch_id, 
        v_scheduler_run_id,
        p_limit, 
        'running', 
        v_start_time, 
        jsonb_build_object(
            'function_call', 'process_due_auto_renewals', 
            'limit', p_limit,
            'called_by', CASE WHEN v_scheduler_run_id IS NOT NULL THEN 'edge_function' ELSE 'direct_call' END,
            'version', '2.0',
            'uses_process_subscription_renewal', true
        )
    );
    
    -- 游标遍历到期的订阅记录（基于实际表结构）
    FOR v_subscription IN (
        SELECT 
            s.id,
            s.user_id
        FROM subscriptions s
        WHERE s.status = 'active' 
          AND s.renewal_type = 'auto' 
          AND s.next_billing_date <= CURRENT_DATE
        ORDER BY s.next_billing_date ASC
        LIMIT p_limit
    ) LOOP
        BEGIN
            -- 调用 process_subscription_renewal 函数处理单个订阅续费
            -- 这个函数包含了防重复支付逻辑和准确的支付历史记录
            PERFORM process_subscription_renewal(
                v_subscription.id,
                v_subscription.user_id
            );
            
            v_processed := v_processed + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
            v_error_msg := SQLERRM;
            -- 记录具体的错误信息到日志中
            RAISE NOTICE 'Error processing subscription %: %', v_subscription.id, v_error_msg;
            CONTINUE;
        END;
    END LOOP;
    
    -- 更新批次记录为完成状态
    UPDATE auto_renew_subscriptions_logs 
    SET 
        status = 'completed',
        completed_at = NOW(),
        processed_count = v_processed + v_errors,
        success_count = v_processed,
        failed_count = v_errors,
        execution_time = EXTRACT(EPOCH FROM (NOW() - v_start_time)) * INTERVAL '1 second',
        metadata = metadata || jsonb_build_object(
            'execution_summary', jsonb_build_object(
                'processed', v_processed,
                'errors', v_errors,
                'execution_time_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time))
            )
        )
    WHERE id = v_batch_id;
    
    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'batch_id', v_batch_id,
        'processed_count', v_processed,
        'error_count', v_errors,
        'execution_time_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time)),
        'scheduler_run_id', v_scheduler_run_id,
        'version', '2.0'
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    -- 全局异常处理
    v_error_msg := SQLERRM;
    
    -- 更新批次记录为失败状态
    UPDATE auto_renew_subscriptions_logs 
    SET 
        status = 'failed',
        completed_at = NOW(),
        processed_count = v_processed,
        success_count = v_processed,
        failed_count = v_errors + 1,
        error_summary = jsonb_build_object('error_message', v_error_msg),
        execution_time = EXTRACT(EPOCH FROM (NOW() - v_start_time)) * INTERVAL '1 second'
    WHERE id = v_batch_id;
    
    -- 返回错误结果
    RETURN jsonb_build_object(
        'success', false,
        'batch_id', v_batch_id,
        'error', v_error_msg,
        'processed_count', v_processed,
        'error_count', v_errors + 1,
        'execution_time_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time)),
        'scheduler_run_id', v_scheduler_run_id,
        'version', '2.0'
    );
END;
$$;
