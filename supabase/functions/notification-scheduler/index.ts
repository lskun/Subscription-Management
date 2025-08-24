import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface NotificationSchedulerRequest {
  function_name: string;
  notification_types: string[];
  check_user_settings?: boolean;
  batch_size?: number;
  max_days_after_expiry?: number;
  max_retry_days?: number;
}

interface SubscriptionWithUser {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  next_billing_date: string;
  status: string;
  renewal_type: string;
  user_profiles: {
    id: string;
    email: string;
    display_name: string;
    timezone: string;
  };
}

interface ProcessingStats {
  totalSubscriptions: number;
  skippedDueToSettings: number;
  skippedDueToDuplicate: number;
  skippedDueToInvalidEmail: number;
  emailsSentSuccessfully: number;
  emailsFailed: number;
  skippedDueToMissingTemplate: number;
  errors: Array<{
    subscriptionId: string;
    userId: string;
    error: string;
    step: string;
  }>;
}

/**
 * 通知类型与用户设置和模板的映射关系
 * 
 * 映射scheduler_jobs.payload.notification_types中的3种类型：
 * - subscription_expiry_reminder: 订阅到期提醒（只处理3天内的提醒）
 * - subscription_expired: 订阅已过期通知
 * - payment_notifications: 支付相关通知
 * 
 * settingKey: 对应user_settings.notifications中的字段名
 * templateKey: 对应unified_notification_templates.template_key
 */
const NOTIFICATION_TEMPLATE_MAPPING: Record<string, {
  settingKey: string;
  templateKey: string[];
}> = {
  // 订阅续费提醒相关 - 需要renewal_reminders权限
  // 只处理3天内的订阅续费提醒，不重复发送
  'subscription_expiry_reminder': {
    settingKey: 'renewal_reminders',
    templateKey: ['subscription_expiry']
  },
  // 订阅已过期通知 - 需要renewal_reminders权限
  'subscription_expired': {
    settingKey: 'renewal_reminders',
    templateKey: ['subscription_expiry']
  },
  // 支付相关通知 - 需要payment_notifications权限
  'payment_notifications': {
    settingKey: 'payment_notifications',
    templateKey: ['payment_failed', 'payment_success']
  }
};

Deno.serve(async (req: Request) => {
  // 只允许POST请求
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 验证Authorization头
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    // 创建Supabase客户端（使用service_role密钥）
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 解析请求体
    const request: NotificationSchedulerRequest = await req.json();
    console.log('Processing notification scheduler request:', request);

    const totalStats: ProcessingStats = {
      totalSubscriptions: 0,
      skippedDueToSettings: 0,
      skippedDueToDuplicate: 0,
      skippedDueToInvalidEmail: 0,
      emailsSentSuccessfully: 0,
      emailsFailed: 0,
      skippedDueToMissingTemplate: 0,
      errors: []
    };

    // 处理每种通知类型
    for (const notificationType of request.notification_types) {
      try {
        if (!NOTIFICATION_TEMPLATE_MAPPING[notificationType]) {
          console.warn(`Unknown notification type: ${notificationType}`);
          continue;
        }

        let stats: ProcessingStats;
        
        switch (notificationType) {
          case 'subscription_expiry_reminder':
            // 处理3天内的订阅到期提醒
            stats = await handleSubscriptionExpiryReminders(supabase, request, notificationType);
            break;
          case 'subscription_expired':
            stats = await handleSubscriptionExpiredNotifications(supabase, request, notificationType);
            break;
          case 'payment_notifications':
            stats = await handlePaymentFailedNotifications(supabase, request, notificationType);
            break;
          default:
            console.warn('Unhandled notification type:', notificationType);
            continue;
        }
        
        // 合并统计数据
        totalStats.totalSubscriptions += stats.totalSubscriptions;
        totalStats.skippedDueToSettings += stats.skippedDueToSettings;
        totalStats.skippedDueToDuplicate += stats.skippedDueToDuplicate;
        totalStats.skippedDueToInvalidEmail += stats.skippedDueToInvalidEmail;
        totalStats.emailsSentSuccessfully += stats.emailsSentSuccessfully;
        totalStats.emailsFailed += stats.emailsFailed;
        totalStats.skippedDueToMissingTemplate += stats.skippedDueToMissingTemplate;
        totalStats.errors.push(...stats.errors);
        
        console.log(`Processed notification type ${notificationType}:`, {
          processed: stats.emailsSentSuccessfully,
          failed: stats.emailsFailed,
          skipped: stats.skippedDueToSettings + stats.skippedDueToDuplicate + stats.skippedDueToInvalidEmail + stats.skippedDueToMissingTemplate
        });
        
      } catch (error) {
        console.error(`Error processing notification type ${notificationType}:`, error);
        totalStats.errors.push({
          subscriptionId: 'N/A',
          userId: 'N/A',
          error: error.message,
          step: `processing_${notificationType}`
        });
      }
    }

    // 输出详细统计
    console.log('Final processing statistics:', totalStats);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${totalStats.emailsSentSuccessfully} notifications across ${request.notification_types.length} types`,
        statistics: {
          totalSubscriptions: totalStats.totalSubscriptions,
          emailsSentSuccessfully: totalStats.emailsSentSuccessfully,
          emailsFailed: totalStats.emailsFailed,
          totalSkipped: totalStats.skippedDueToSettings + totalStats.skippedDueToDuplicate + totalStats.skippedDueToInvalidEmail + totalStats.skippedDueToMissingTemplate,
          breakdown: {
            skippedDueToSettings: totalStats.skippedDueToSettings,
            skippedDueToDuplicate: totalStats.skippedDueToDuplicate,
            skippedDueToInvalidEmail: totalStats.skippedDueToInvalidEmail,
            skippedDueToMissingTemplate: totalStats.skippedDueToMissingTemplate
          },
          errorCount: totalStats.errors.length
        },
        notificationTypes: request.notification_types,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Notification scheduler error:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        stack: error.stack 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * 处理订阅到期提醒通知（用户级聚合处理，3天内到期的订阅聚合为一封邮件）
 */
async function handleSubscriptionExpiryReminders(
  supabase: any,
  request: NotificationSchedulerRequest,
  notificationType: string
): Promise<ProcessingStats> {
  
  // 固定为3天提醒，按用户要求只处理3天内的订阅续费提醒
  const daysBeforeExpiry = 3;
  console.log(`Checking subscriptions expiring in exactly ${daysBeforeExpiry} days for user-level aggregation...`);

  const stats: ProcessingStats = {
    totalSubscriptions: 0,
    skippedDueToSettings: 0,
    skippedDueToDuplicate: 0,
    skippedDueToInvalidEmail: 0,
    emailsSentSuccessfully: 0,
    emailsFailed: 0,
    skippedDueToMissingTemplate: 0,
    errors: []
  };

  const batchSize = request.batch_size || 100;
  let offset = 0;
  let hasMore = true;
  
  // 用于聚合同一用户的多个订阅
  const userSubscriptionsMap = new Map<string, {
    user: any;
    subscriptions: SubscriptionWithUser[];
  }>();

  // 第一步：收集所有即将到期的订阅，按用户聚合
  while (hasMore) {
    // 计算目标日期（今天 + 3天）
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    console.log(`🔍 [DEBUG] 查询条件详情:`, {
      daysBeforeExpiry,
      targetDate: targetDate.toISOString(),
      targetDateStr,
      queryCondition: `next_billing_date = '${targetDateStr}'`,
      offset,
      batchSize,
      currentBatch: Math.floor(offset / batchSize) + 1
    });

    // 查询即将到期的订阅（基于next_billing_date）
    // 先查询订阅，然后单独查询用户资料
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        user_id,
        name,
        amount,
        currency,
        billing_cycle,
        next_billing_date,
        status,
        renewal_type
      `)
      .eq('status', 'active')
      .eq('next_billing_date', targetDateStr)
      .range(offset, offset + batchSize - 1);

    console.log(`📊 [DEBUG] 订阅查询结果:`, {
      found: subscriptions?.length || 0,
      error: subError?.message || null,
      subscriptions: subscriptions?.map(s => ({
        id: s.id,
        name: s.name,
        user_id: s.user_id,
        next_billing_date: s.next_billing_date,
        status: s.status
      })) || []
    });

    if (subError) {
      console.error('❌ [DEBUG] Error fetching subscriptions:', subError);
      stats.errors.push({
        subscriptionId: 'N/A',
        userId: 'N/A',
        error: subError.message,
        step: 'fetch_subscriptions'
      });
      break;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`ℹ️ [DEBUG] 没有找到符合条件的订阅，结束查询`);
      hasMore = false;
      break;
    }

    // 查询相关的用户资料
    const userIds = [...new Set(subscriptions.map(s => s.user_id))];
    console.log(`👥 [DEBUG] 查询用户资料，用户ID:`, userIds);
    
    const { data: userProfiles, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        display_name,
        timezone
      `)
      .in('id', userIds);

    console.log(`👤 [DEBUG] 用户资料查询结果:`, {
      found: userProfiles?.length || 0,
      error: profileError?.message || null,
      profiles: userProfiles?.map(p => ({
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        timezone: p.timezone
      })) || []
    });

    if (profileError) {
      console.error('❌ [DEBUG] Error fetching user profiles:', profileError);
      stats.errors.push({
        subscriptionId: 'N/A',
        userId: 'N/A',
        error: profileError.message,
        step: 'fetch_user_profiles'
      });
      break;
    }

    // 创建用户资料映射
    const profileMap = new Map(userProfiles?.map(p => [p.id, p]) || []);
    console.log(`🗺️ [DEBUG] 用户资料映射创建完成:`, {
      totalProfiles: profileMap.size,
      mappedUserIds: Array.from(profileMap.keys())
    });

    // 组合数据
    const subscriptionsWithUsers = subscriptions
      .filter(sub => profileMap.has(sub.user_id))
      .map(sub => ({
        ...sub,
        user_profiles: profileMap.get(sub.user_id)!
      }));

    console.log(`🔗 [DEBUG] 订阅与用户数据组合结果:`, {
      totalSubscriptions: subscriptions.length,
      withValidUsers: subscriptionsWithUsers.length,
      filteredOut: subscriptions.length - subscriptionsWithUsers.length,
      subscriptionsWithUsers: subscriptionsWithUsers.map(s => ({
        subscriptionId: s.id,
        subscriptionName: s.name,
        userId: s.user_id,
        userEmail: s.user_profiles.email,
        nextBillingDate: s.next_billing_date
      }))
    });

    // 统计总数（过滤后的有效订阅）
    stats.totalSubscriptions += subscriptionsWithUsers.length;

    // 按用户聚合订阅
    for (const subscription of subscriptionsWithUsers as SubscriptionWithUser[]) {
      const userId = subscription.user_id;
      
      if (!userSubscriptionsMap.has(userId)) {
        userSubscriptionsMap.set(userId, {
          user: subscription.user_profiles,
          subscriptions: []
        });
        console.log(`➕ [DEBUG] 新增用户到聚合映射: ${userId} (${subscription.user_profiles.email})`);
      }
      
      userSubscriptionsMap.get(userId)!.subscriptions.push(subscription);
      console.log(`📋 [DEBUG] 添加订阅到用户聚合: ${subscription.name} -> ${userId}`);
    }

    offset += batchSize;
    hasMore = subscriptions.length === batchSize;
  }

  console.log(`🎯 [DEBUG] 订阅聚合完成:`, {
    totalSubscriptions: stats.totalSubscriptions,
    totalUsers: userSubscriptionsMap.size,
    userSubscriptionDetails: Array.from(userSubscriptionsMap.entries()).map(([userId, userData]) => ({
      userId,
      userEmail: userData.user.email,
      subscriptionCount: userData.subscriptions.length,
      subscriptions: userData.subscriptions.map(s => s.name)
    }))
  });

  // 第二步：为每个用户发送聚合邮件
  for (const [userId, userData] of userSubscriptionsMap) {
    console.log(`📧 [DEBUG] 开始处理用户通知: ${userId} (${userData.user.email})`);
    console.log(`📋 [DEBUG] 用户订阅详情:`, {
      subscriptionCount: userData.subscriptions.length,
      subscriptions: userData.subscriptions.map(s => ({
        id: s.id,
        name: s.name,
        nextBillingDate: s.next_billing_date
      }))
    });

    try {
      const result = await processUserAggregatedNotification(
        supabase,
        userId,
        userData,
        notificationType,
        daysBeforeExpiry,
        request.check_user_settings
      );

      console.log(`📊 [DEBUG] 用户通知处理结果: ${userId}`, {
        success: result.success,
        reason: result.reason,
        error: result.error
      });

      // 更新统计（一个用户算一次）
      if (result.success) {
        stats.emailsSentSuccessfully++;
        console.log(`✅ [DEBUG] 用户 ${userId} 邮件发送成功`);
      } else {
        switch (result.reason) {
          case 'disabled_by_user':
            stats.skippedDueToSettings++;
            console.log(`⚙️ [DEBUG] 用户 ${userId} 已禁用通知设置`);
            break;
          case 'already_sent':
            stats.skippedDueToDuplicate++;
            console.log(`🔄 [DEBUG] 用户 ${userId} 已收到重复通知，跳过`);
            break;
          case 'invalid_email':
            stats.skippedDueToInvalidEmail++;
            console.log(`📧 [DEBUG] 用户 ${userId} 邮箱无效: ${userData.user.email}`);
            break;
          case 'missing_template':
            stats.skippedDueToMissingTemplate++;
            console.log(`🎨 [DEBUG] 用户 ${userId} 缺少邮件模板`);
            break;
          case 'send_failed':
            stats.emailsFailed++;
            console.log(`❌ [DEBUG] 用户 ${userId} 邮件发送失败: ${result.error}`);
            stats.errors.push({
              subscriptionId: userData.subscriptions.map(s => s.id).join(','),
              userId: userId,
              error: result.error || 'Email sending failed',
              step: 'send_email'
            });
            break;
        }
      }
      
    } catch (error) {
      console.error(`❌ [DEBUG] Failed to process user ${userId}:`, error);
      stats.emailsFailed++;
      stats.errors.push({
        subscriptionId: userData.subscriptions.map(s => s.id).join(','),
        userId: userId,
        error: (error as Error).message,
        step: 'process_user'
      });
    }
  }

  console.log(`Completed ${notificationType}: processed ${stats.totalSubscriptions} subscriptions for ${userSubscriptionsMap.size} users, sent ${stats.emailsSentSuccessfully} emails`);
  return stats;
}

/**
 * 处理用户的聚合通知（多个订阅聚合为一封邮件）
 */
async function processUserAggregatedNotification(
  supabase: any,
  userId: string,
  userData: { user: any; subscriptions: SubscriptionWithUser[] },
  notificationType: string,
  daysBeforeExpiry: number,
  checkUserSettings?: boolean
): Promise<{
  success: boolean;
  reason?: string;
  error?: string;
}> {
  
  console.log(`🔍 [DEBUG-USER] 开始处理用户聚合通知: ${userId}`);

  const mapping = NOTIFICATION_TEMPLATE_MAPPING[notificationType];
  console.log(`🗂️ [DEBUG-USER] 通知类型映射:`, {
    notificationType,
    mapping: mapping ? {
      settingKey: mapping.settingKey,
      templateKeys: mapping.templateKey
    } : null
  });

  if (!mapping) {
    console.log(`❌ [DEBUG-USER] 未知通知类型: ${notificationType}`);
    return { success: false, reason: 'unknown_notification_type' };
  }

  const { user, subscriptions } = userData;

  // 1. 验证邮箱有效性
  console.log(`📧 [DEBUG-USER] 验证邮箱: ${user.email}`);
  if (!user.email || !isValidEmail(user.email)) {
    console.log(`❌ [DEBUG-USER] Invalid email for user ${userId}: ${user.email}`);
    return { success: false, reason: 'invalid_email' };
  }

  // 2. 检查用户通知设置
  if (checkUserSettings) {
    console.log(`⚙️ [DEBUG-USER] 检查用户通知设置: ${mapping.settingKey}`);
    const shouldNotify = await checkUserNotificationSettings(
      supabase, 
      userId, 
      mapping.settingKey
    );
    
    console.log(`⚙️ [DEBUG-USER] 用户通知设置结果: shouldNotify=${shouldNotify}`);
    
    if (!shouldNotify) {
      console.log(`⚙️ [DEBUG-USER] User ${userId} has disabled ${mapping.settingKey} notifications`);
      return { success: false, reason: 'disabled_by_user' };
    }
  } else {
    console.log(`⚙️ [DEBUG-USER] 跳过用户设置检查 (checkUserSettings=false)`);
  }

  // 3. 检查用户级重复发送（3天内是否已发送过到期提醒）
  console.log(`🔄 [DEBUG-USER] 检查重复发送: ${notificationType}`);
  const alreadySent = await checkUserLevelNotificationAlreadySent(
    supabase,
    userId,
    notificationType
  );

  console.log(`🔄 [DEBUG-USER] 重复发送检查结果: alreadySent=${alreadySent}`);

  if (alreadySent) {
    console.log(`🔄 [DEBUG-USER] User ${userId} already received ${notificationType} notification within 3 days`);
    return { success: false, reason: 'already_sent' };
  }

  // 4. 准备聚合通知数据
  console.log(`📝 [DEBUG-USER] 准备聚合通知数据`);
  const userTimezone = user.timezone || 'UTC';
  const aggregatedData = prepareAggregatedNotificationData(subscriptions, daysBeforeExpiry, userTimezone, user);
  
  console.log(`📝 [DEBUG-USER] 聚合数据详情:`, {
    displayName: aggregatedData.displayName,
    subscriptionCount: aggregatedData.subscriptionCount,
    subscriptionNames: subscriptions.map(s => s.name),
    userTimezone: userTimezone,
    daysBeforeExpiry: daysBeforeExpiry
  });

  // 5. 选择合适的模板键
  const selectedTemplateKey = selectTemplateKey(notificationType, mapping.templateKey, aggregatedData);
  console.log(`🎨 [DEBUG-USER] 选择的模板键: ${selectedTemplateKey}`);
  
  // 6. 检查邮件模板是否存在
  console.log(`🎨 [DEBUG-USER] 检查邮件模板是否存在: ${selectedTemplateKey}`);
  const templateExists = await checkEmailTemplateExists(supabase, selectedTemplateKey);
  console.log(`🎨 [DEBUG-USER] 模板存在性检查结果: ${templateExists}`);
  
  if (!templateExists) {
    console.warn(`❌ [DEBUG-USER] Email template not found: ${selectedTemplateKey}`);
    return { success: false, reason: 'missing_template' };
  }

  // 7. 发送聚合邮件通知
  console.log(`📬 [DEBUG-USER] 准备发送聚合邮件通知`, {
    userId,
    recipient: user.email,
    templateKey: selectedTemplateKey,
    notificationType,
    subscriptionCount: subscriptions.length
  });

  try {
    await sendAggregatedEmailNotification(supabase, {
      userId: userId,
      recipient: user.email,
      templateKey: selectedTemplateKey,
      notificationType: notificationType,
      data: aggregatedData,
      userTimezone: userTimezone,
      subscriptions: subscriptions
    });

    console.log(`✅ [DEBUG-USER] Aggregated email sent successfully for ${subscriptions.length} subscriptions to user ${userId} (${user.email})`);
    return { success: true };
    
  } catch (error) {
    console.error(`❌ [DEBUG-USER] Failed to send aggregated email for user ${userId}:`, error);
    return { success: false, reason: 'send_failed', error: (error as Error).message };
  }
}

/**
 * 处理订阅已过期通知
 */
async function handleSubscriptionExpiredNotifications(
  supabase: any, 
  request: NotificationSchedulerRequest,
  notificationType: string
): Promise<ProcessingStats> {
  
  console.log('Checking expired subscriptions...');
  
  const stats: ProcessingStats = {
    totalSubscriptions: 0,
    skippedDueToSettings: 0,
    skippedDueToDuplicate: 0,
    skippedDueToInvalidEmail: 0,
    emailsSentSuccessfully: 0,
    emailsFailed: 0,
    skippedDueToMissingTemplate: 0,
    errors: []
  };

  // 暂时返回空统计，等待具体实现
  console.log('Subscription expired notification handling - placeholder implementation');
  
  return stats;
}

/**
 * 处理支付失败通知
 */
async function handlePaymentFailedNotifications(
  supabase: any, 
  request: NotificationSchedulerRequest,
  notificationType: string
): Promise<ProcessingStats> {
  
  console.log('Checking failed payments...');
  
  const stats: ProcessingStats = {
    totalSubscriptions: 0,
    skippedDueToSettings: 0,
    skippedDueToDuplicate: 0,
    skippedDueToInvalidEmail: 0,
    emailsSentSuccessfully: 0,
    emailsFailed: 0,
    skippedDueToMissingTemplate: 0,
    errors: []
  };

  // 暂时返回空统计，等待具体实现
  console.log('Payment failed notification handling - placeholder implementation');
  
  return stats;
}

/**
 * 根据通知类型和数据选择合适的模板键
 */
function selectTemplateKey(
  notificationType: string, 
  templateKeys: string[], 
  notificationData: Record<string, any>
): string {
  switch (notificationType) {
    case 'subscription_expiry_reminder':
    case 'subscription_expired':
      // 订阅相关通知始终使用第一个模板（subscription_expiry）
      return templateKeys[0];
      
    case 'payment_notifications':
      // 支付通知根据支付状态选择模板
      // templateKeys[0] = 'payment_failed', templateKeys[1] = 'payment_success'
      const paymentStatus = notificationData.paymentStatus || 'failed';
      return paymentStatus === 'success' ? templateKeys[1] || templateKeys[0] : templateKeys[0];
      
    default:
      // 默认使用第一个模板
      return templateKeys[0];
  }
}

/**
 * 处理单个订阅的通知发送
 */
async function processSubscriptionNotification(
  supabase: any,
  subscription: SubscriptionWithUser,
  notificationType: string,
  daysBeforeExpiry: number,
  checkUserSettings?: boolean
): Promise<{
  success: boolean;
  reason?: string;
  error?: string;
}> {
  
  const mapping = NOTIFICATION_TEMPLATE_MAPPING[notificationType];
  if (!mapping) {
    return { success: false, reason: 'unknown_notification_type' };
  }

  // 1. 验证邮箱有效性
  if (!subscription.user_profiles.email || !isValidEmail(subscription.user_profiles.email)) {
    console.log(`Invalid email for user ${subscription.user_id}: ${subscription.user_profiles.email}`);
    return { success: false, reason: 'invalid_email' };
  }

  // 2. 检查用户通知设置
  if (checkUserSettings) {
    const shouldNotify = await checkUserNotificationSettings(
      supabase, 
      subscription.user_id, 
      mapping.settingKey
    );
    
    if (!shouldNotify) {
      console.log(`User ${subscription.user_id} has disabled ${mapping.settingKey} notifications`);
      return { success: false, reason: 'disabled_by_user' };
    }
  }

  // 3. 检查是否已经发送过相同的通知（防重复）
  const alreadySent = await checkNotificationAlreadySent(
    supabase,
    subscription.user_id,
    notificationType,
    subscription.id,
    subscription.next_billing_date  // 传递当前的计费日期用于精确检查
  );

  if (alreadySent) {
    console.log(`Notification already sent for subscription ${subscription.id}`);
    return { success: false, reason: 'already_sent' };
  }

  // 4. 准备通知数据（考虑用户时区）
  const userTimezone = subscription.user_profiles.timezone || 'UTC';
  const notificationData = prepareNotificationData(subscription, daysBeforeExpiry, userTimezone);

  // 5. 选择合适的模板键
  const selectedTemplateKey = selectTemplateKey(notificationType, mapping.templateKey, notificationData);
  
  // 6. 检查邮件模板是否存在
  const templateExists = await checkEmailTemplateExists(supabase, selectedTemplateKey);
  if (!templateExists) {
    console.warn(`Email template not found: ${selectedTemplateKey}`);
    return { success: false, reason: 'missing_template' };
  }

  // 7. 发送邮件通知
  try {
    await sendEmailNotification(supabase, {
      userId: subscription.user_id,
      recipient: subscription.user_profiles.email,
      templateKey: selectedTemplateKey,
      notificationType: notificationType,
      data: notificationData,
      userTimezone: userTimezone
    });

    console.log(`Email sent successfully for subscription ${subscription.id} to ${subscription.user_profiles.email}`);
    return { success: true };
    
  } catch (error) {
    console.error(`Failed to send email for subscription ${subscription.id}:`, error);
    return { success: false, reason: 'send_failed', error: (error as Error).message };
  }
}

/**
 * 检查用户通知设置
 * 策略：无设置时不发送通知（避免骚扰）
 */
async function checkUserNotificationSettings(
  supabase: any, 
  userId: string, 
  settingKey: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('setting_value')
      .eq('user_id', userId)
      .eq('setting_key', 'notifications')
      .single();

    if (error || !data) {
      // 策略1：无设置时不发送通知
      console.log(`No notification settings found for user ${userId}, skipping notification`);
      return false;
    }

    const notifications = data.setting_value;
    if (!notifications || typeof notifications !== 'object') {
      console.log(`Invalid notification settings format for user ${userId}`);
      return false;
    }

    // 检查email总开关和具体功能开关
    const emailEnabled = notifications.email === true;
    const settingEnabled = notifications[settingKey] === true;
    
    console.log(`User ${userId} settings: email=${emailEnabled}, ${settingKey}=${settingEnabled}`);
    return emailEnabled && settingEnabled;
    
  } catch (error) {
    console.error('Error checking user notification settings:', error);
    return false; // 保守策略：出错时不发送
  }
}

/**
 * 检查用户级别是否已发送过通知（用于聚合通知的重复检查）
 * 对于订阅到期提醒：检查3天内是否已发送过聚合提醒
 */
async function checkUserLevelNotificationAlreadySent(
  supabase: any,
  userId: string,
  notificationType: string
): Promise<boolean> {
  try {
    // 对于订阅到期提醒，检查3天内是否已发送过
    if (notificationType === 'subscription_expiry_reminder') {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const { data, error } = await supabase
        .from('notification_logs_v2')
        .select('id, sent_at')
        .eq('user_id', userId)
        .eq('notification_type', notificationType)
        .eq('status', 'sent')
        .gte('sent_at', threeDaysAgo.toISOString());

      if (error) {
        console.error('Error checking user-level notification history:', error);
        return false;
      }

      const hasRecentNotification = data && data.length > 0;
      if (hasRecentNotification) {
        console.log(`User ${userId} already received ${notificationType} within 3 days, found ${data.length} notification(s)`);
      }

      return hasRecentNotification;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking user-level notification history:', error);
    return false;
  }
}

/**
 * 检查是否已发送相同通知（防重复）
 * 对于所有订阅相关通知：检查当前计费周期是否已发送过，确保每个计费周期只提醒一次
 * 包括：3天续费提醒、订阅过期通知、支付相关通知
 */
async function checkNotificationAlreadySent(
  supabase: any,
  userId: string,
  notificationType: string,
  subscriptionId: string,
  currentBillingDate?: string
): Promise<boolean> {
  try {
    if (['subscription_expiry_reminder', 'subscription_expired', 'payment_notifications'].includes(notificationType) && currentBillingDate) {
      // 所有订阅相关通知：检查是否已对当前的next_billing_date发送过通知
      // 通过检查metadata和发送时间来判断是否为同一计费周期
      const { data, error } = await supabase
        .from('notification_logs_v2')
        .select('id, sent_at, metadata')
        .eq('user_id', userId)
        .eq('notification_type', notificationType)
        .eq('metadata->>subscriptionId', subscriptionId)
        .eq('status', 'sent'); // 只检查成功发送的通知

      if (error) {
        console.error('Error checking notification history for billing cycle:', error);
        return false;
      }

      // 检查是否有针对当前billing date的通知
      const hasSentForCurrentBilling = data && data.some(record => {
        try {
          const recordBillingDate = new Date(currentBillingDate).toISOString().split('T')[0];
          const sentDate = new Date(record.sent_at).toISOString().split('T')[0];
          
          // 根据不同通知类型判断是否为同一计费周期
          if (notificationType === 'subscription_expiry_reminder') {
            // 3天提醒：检查发送日期是否是billing date的3天前
            const targetSendDate = new Date(recordBillingDate);
            targetSendDate.setDate(targetSendDate.getDate() - 3);
            const expectedSendDate = targetSendDate.toISOString().split('T')[0];
            return sentDate === expectedSendDate;
          } else if (notificationType === 'subscription_expired') {
            // 过期通知：检查发送日期是否是在billing date当天或之后的合理范围内
            const expiredDate = new Date(recordBillingDate);
            const maxDaysAfterExpiry = 7; // 过期后7天内的通知都算同一周期
            for (let i = 0; i <= maxDaysAfterExpiry; i++) {
              const checkDate = new Date(expiredDate);
              checkDate.setDate(checkDate.getDate() + i);
              if (sentDate === checkDate.toISOString().split('T')[0]) {
                return true;
              }
            }
            return false;
          } else if (notificationType === 'payment_notifications') {
            // 支付通知：检查发送日期是否在billing date前后的合理范围内
            const billingDate = new Date(recordBillingDate);
            const daysBefore = 3;
            const daysAfter = 3;
            for (let i = -daysBefore; i <= daysAfter; i++) {
              const checkDate = new Date(billingDate);
              checkDate.setDate(checkDate.getDate() + i);
              if (sentDate === checkDate.toISOString().split('T')[0]) {
                return true;
              }
            }
            return false;
          }
          
          return false;
        } catch (e) {
          console.warn('Error parsing notification metadata:', e);
          return false;
        }
      });

      if (hasSentForCurrentBilling) {
        console.log(`Found existing ${notificationType} notification for billing date ${currentBillingDate}, will only remind once per billing cycle`);
      }

      return hasSentForCurrentBilling;
    } else {
      // 其他通知类型：只检查今天是否发送过
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('notification_logs_v2')
        .select('id, sent_at, metadata')
        .eq('user_id', userId)
        .eq('notification_type', notificationType)
        .eq('metadata->>subscriptionId', subscriptionId)
        .eq('status', 'sent') // 只检查成功发送的通知
        .gte('sent_at', today + ' 00:00:00')
        .lt('sent_at', today + ' 23:59:59');

      if (error) {
        console.error('Error checking notification history for today:', error);
        return false;
      }

      const hasSentToday = data && data.length > 0;
      if (hasSentToday) {
        console.log(`Found existing notification for today, skipping duplicate - found ${data.length} notification(s)`);
      }

      return hasSentToday;
    }
  } catch (error) {
    console.error('Error checking notification history:', error);
    return false;
  }
}

/**
 * 检查邮件模板是否存在
 */
async function checkEmailTemplateExists(
  supabase: any,
  templateKey: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('unified_notification_templates')
      .select('id')
      .eq('template_key', templateKey)
      .eq('channel_type', 'email')
      .eq('is_active', true)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error(`Error checking template ${templateKey}:`, error);
    return false;
  }
}

/**
 * 准备聚合通知数据（多个订阅）
 */
function prepareAggregatedNotificationData(
  subscriptions: SubscriptionWithUser[],
  daysBeforeExpiry: number,
  userTimezone: string,
  user: any
): Record<string, any> {
  
  const displayName = user.display_name || 'User';
  const subscriptionCount = subscriptions.length;
  
  // 构建订阅列表（文本格式）
  const subscriptionListText = subscriptions.map(sub => {
    const amount = `${sub.currency} ${sub.amount}`;
    const expiryDate = formatDateInTimezone(sub.next_billing_date, userTimezone);
    const daysLeft = Math.ceil((new Date(sub.next_billing_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return `• ${sub.name} (${amount}) - expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} on ${expiryDate}`;
  }).join('\n');

  // 构建订阅列表（HTML格式）
  const subscriptionListHtml = subscriptions.map(sub => {
    const amount = `${sub.currency} ${sub.amount}`;
    const expiryDate = formatDateInTimezone(sub.next_billing_date, userTimezone);
    const daysLeft = Math.ceil((new Date(sub.next_billing_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const urgencyClass = daysLeft <= 1 ? 'days-urgent' : daysLeft <= 3 ? 'days-warning' : '';
    
    return `<li class="expiry-item">
      <strong>${sub.name}</strong> (${amount}) - expires in <span class="${urgencyClass}">${daysLeft} day${daysLeft === 1 ? '' : 's'}</span> on ${expiryDate}
    </li>`;
  }).join('');

  // 找出最早到期日期
  const earliestExpiry = subscriptions.reduce((earliest, sub) => {
    return new Date(sub.next_billing_date) < new Date(earliest.next_billing_date) ? sub : earliest;
  });

  // 兼容单订阅模板变量（使用第一个或最紧急的订阅）
  const primarySubscription = subscriptions[0];
  
  return {
    displayName,
    subscriptionCount,
    subscriptionList: subscriptionListText,
    subscriptionListHtml,
    earliestExpiryDate: formatDateInTimezone(earliestExpiry.next_billing_date, userTimezone),
    
    // 单订阅兼容变量（使用主要订阅）
    subscriptionName: subscriptionCount === 1 ? primarySubscription.name : `${subscriptionCount} subscriptions`,
    expiryDate: formatDateInTimezone(primarySubscription.next_billing_date, userTimezone),
    amount: primarySubscription.amount,
    currency: primarySubscription.currency,
    billingCycle: primarySubscription.billing_cycle,
    nextPaymentDate: formatDateInTimezone(primarySubscription.next_billing_date, userTimezone),
    renewalUrl: `${Deno.env.get('FRONTEND_URL') || 'https://your-app.com'}/subscriptions`,
    subscriptionId: subscriptions.map(s => s.id).join(','),
    daysBeforeExpiry: daysBeforeExpiry,
    daysLeft: daysBeforeExpiry,
    userTimezone: userTimezone
  };
}

/**
 * 准备通知数据（考虑用户时区）
 */
function prepareNotificationData(
  subscription: SubscriptionWithUser,
  daysBeforeExpiry: number,
  userTimezone: string
): Record<string, any> {
  
  const displayName = subscription.user_profiles.display_name || 'User';
  
  return {
    displayName,
    subscriptionName: subscription.name,
    expiryDate: formatDateInTimezone(subscription.next_billing_date, userTimezone),
    amount: subscription.amount,
    currency: subscription.currency,
    billingCycle: subscription.billing_cycle,
    nextPaymentDate: formatDateInTimezone(subscription.next_billing_date, userTimezone),
    renewalUrl: `${Deno.env.get('FRONTEND_URL') || 'https://your-app.com'}/subscriptions?id=${subscription.id}`,
    subscriptionId: subscription.id,
    daysBeforeExpiry: daysBeforeExpiry,
    daysLeft: daysBeforeExpiry,  // 模板兼容性
    userTimezone: userTimezone
  };
}

/**
 * 发送聚合邮件通知并记录日志
 */
async function sendAggregatedEmailNotification(
  supabase: any,
  params: {
    userId: string;
    recipient: string;
    templateKey: string;
    notificationType: string;
    data: Record<string, any>;
    userTimezone: string;
    subscriptions: SubscriptionWithUser[];
  }
) {
  const startTime = Date.now();
  
  // 构建内容预览（英文）
  const subscriptionCount = params.subscriptions.length;
  const contentPreview = subscriptionCount === 1 
    ? `${params.subscriptions[0].name} expires in ${params.data.daysLeft} days`
    : `${subscriptionCount} subscriptions expiring soon`;
  
  // 构建主题（英文）
  const subject = subscriptionCount === 1 
    ? `⏰ ${params.subscriptions[0].name} Subscription Expiring Soon`
    : `⏰ ${subscriptionCount} Subscription${subscriptionCount === 1 ? '' : 's'} Expiring Soon`;

  const logData = {
    user_id: params.userId,
    notification_type: params.notificationType,
    channel_type: 'email',
    recipient: params.recipient,
    subject: subject,
    content_preview: contentPreview,
    status: 'pending' as string,
    error_message: null as string | null,
    sent_at: new Date().toISOString(),
    metadata: {
      subscriptionIds: params.subscriptions.map(s => s.id),
      subscriptionCount: subscriptionCount,
      templateKey: params.templateKey,
      userTimezone: params.userTimezone,
      daysBeforeExpiry: params.data.daysBeforeExpiry,
      sendDurationMs: 0  // 初始化，稍后更新
    }
  };

  try {
    // 调用邮件发送服务
    console.log(`📤 [DEBUG-EMAIL] 调用邮件发送服务:`, {
      function: 'send-notification-email',
      recipient: params.recipient,
      templateKey: params.templateKey,
      userId: params.userId,
      notificationType: params.notificationType,
      dataKeys: Object.keys(params.data),
      subscriptionCount: params.subscriptions.length
    });

    const { data: invokeData, error } = await supabase.functions.invoke('send-notification-email', {
      body: {
        to: params.recipient,
        template: params.templateKey,
        data: params.data,
        userId: params.userId,
        notificationType: params.notificationType
      }
    });

    const duration = Date.now() - startTime;

    console.log(`📤 [DEBUG-EMAIL] 邮件发送服务响应:`, {
      duration: `${duration}ms`,
      error: error?.message || null,
      invokeData: invokeData || null
    });

    if (error) {
      console.error(`❌ [DEBUG-EMAIL] Email service error:`, error);
      throw new Error(`Email service error: ${error.message}`);
    }

    // 发送成功
    logData.status = 'sent';
    logData.metadata.sendDurationMs = duration;
    
    console.log(`📝 [DEBUG-EMAIL] 记录发送成功日志到 notification_logs_v2`);
    
    // 记录发送日志
    const { error: logError } = await supabase
      .from('notification_logs_v2')
      .insert(logData);

    if (logError) {
      console.error(`❌ [DEBUG-EMAIL] 记录发送日志失败:`, logError);
    } else {
      console.log(`✅ [DEBUG-EMAIL] 发送日志记录成功`);
    }

    console.log(`✅ [DEBUG-EMAIL] Aggregated email sent successfully in ${duration}ms to ${params.recipient} for ${subscriptionCount} subscriptions`);
    
  } catch (error) {
    // 发送失败
    const duration = Date.now() - startTime;
    logData.status = 'failed';
    logData.error_message = (error as Error).message;
    logData.metadata.sendDurationMs = duration;
    
    console.error(`❌ [DEBUG-EMAIL] 邮件发送失败:`, {
      error: (error as Error).message,
      duration: `${duration}ms`,
      recipient: params.recipient,
      templateKey: params.templateKey
    });
    
    // 记录失败日志
    console.log(`📝 [DEBUG-EMAIL] 记录发送失败日志到 notification_logs_v2`);
    try {
      const { error: logError } = await supabase
        .from('notification_logs_v2')
        .insert(logData);
        
      if (logError) {
        console.error(`❌ [DEBUG-EMAIL] 记录失败日志失败:`, logError);
      } else {
        console.log(`✅ [DEBUG-EMAIL] 失败日志记录成功`);
      }
    } catch (logError) {
      console.error(`❌ [DEBUG-EMAIL] Failed to log aggregated notification failure:`, logError);
    }

    throw error;
  }
}

/**
 * 发送邮件通知并记录日志
 */
async function sendEmailNotification(
  supabase: any,
  params: {
    userId: string;
    recipient: string;
    templateKey: string;
    notificationType: string;
    data: Record<string, any>;
    userTimezone: string;
  }
) {
  const startTime = Date.now();
  const logData = {
    user_id: params.userId,
    notification_type: params.notificationType,
    channel_type: 'email',
    recipient: params.recipient,
    subject: `${params.data.subscriptionName} 通知`,
    content_preview: `${params.data.subscriptionName} 将在 ${params.data.daysLeft} 天后到期`,
    status: 'pending' as string,
    error_message: null as string | null,
    sent_at: new Date().toISOString(),
    metadata: {
      subscriptionId: params.data.subscriptionId,
      templateKey: params.templateKey,
      userTimezone: params.userTimezone,
      daysBeforeExpiry: params.data.daysBeforeExpiry,
      sendDurationMs: 0  // 初始化，稍后更新
    }
  };

  try {
    // 调用邮件发送服务
    const { error } = await supabase.functions.invoke('send-notification-email', {
      body: {
        to: params.recipient,
        template: params.templateKey,
        data: params.data,
        userId: params.userId,
        notificationType: params.notificationType
      }
    });

    const duration = Date.now() - startTime;

    if (error) {
      throw new Error(`Email service error: ${error.message}`);
    }

    // 发送成功
    logData.status = 'sent';
    logData.metadata.sendDurationMs = duration;
    
    // 记录发送日志
    await supabase
      .from('notification_logs_v2')
      .insert(logData);

    console.log(`Email sent successfully in ${duration}ms to ${params.recipient}`);
    
  } catch (error) {
    // 发送失败
    const duration = Date.now() - startTime;
    logData.status = 'failed';
    logData.error_message = (error as Error).message;
    logData.metadata.sendDurationMs = duration;
    
    // 记录失败日志
    try {
      await supabase
        .from('notification_logs_v2')
        .insert(logData);
    } catch (logError) {
      console.error('Failed to log notification failure:', logError);
    }

    throw error;
  }
}

/**
 * 验证邮箱格式
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 根据用户时区格式化日期
 */
function formatDateInTimezone(dateStr: string, timezone: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: timezone || 'UTC'
    });
  } catch (error) {
    console.warn(`Failed to format date ${dateStr} in timezone ${timezone}:`, error);
    return dateStr;
  }
}