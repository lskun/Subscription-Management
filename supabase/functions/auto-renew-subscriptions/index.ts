import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * 自动续费订阅处理 Edge Function
 * 处理到期的自动续费订阅，创建支付记录并更新下次计费日期
 */
Deno.serve(async (req: Request) => {
  try {
    // 获取环境变量
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // 创建 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 从请求体中获取参数
    const { scheduler_run_id: schedulerRunId, limit = 500 } = await req.json().catch(() => ({}));
    
    console.log('开始处理自动续费订阅', { schedulerRunId, limit });
    
    let batchResult;
    let processedCount = 0;
    let totalErrors = 0;
    
    // 批量处理循环
    do {
      try {
        // 调用数据库函数处理批次，直接传递 scheduler_run_id 参数
        const { data, error } = await supabase.rpc('process_due_auto_renewals', {
          p_limit: limit,
          p_scheduler_run_id: schedulerRunId
        });
        
        if (error) {
          console.error('批处理函数调用失败:', error);
          throw new Error(`批处理函数调用失败: ${error.message}`);
        }
        
        batchResult = data;
        processedCount += batchResult.processed_count || 0;
        totalErrors += batchResult.error_count || 0;
        
        console.log('批次处理完成:', {
          batchId: batchResult.batch_id,
          processed: batchResult.processed_count,
          errors: batchResult.error_count,
          schedulerRunId: batchResult.scheduler_run_id
        });
        
      } catch (batchError) {
        console.error('批次处理异常:', batchError);
        totalErrors++;
        break;
      }
      
    } while (batchResult && batchResult.processed_count > 0);
    
    // 返回处理结果
    const response = {
      success: true,
      message: '自动续费处理完成',
      data: {
        total_processed: processedCount,
        total_errors: totalErrors,
        scheduler_run_id: schedulerRunId,
        last_batch_id: batchResult?.batch_id
      }
    };
    
    console.log('自动续费处理完成:', response.data);
    
    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      }
    });
    
  } catch (error) {
    console.error('自动续费处理失败:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '未知错误',
        message: '自动续费处理失败'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
});


