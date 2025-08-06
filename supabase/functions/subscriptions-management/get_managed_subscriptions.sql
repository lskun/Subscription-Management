-- This script defines the highly optimized PostgreSQL function for managing subscriptions.
-- It's designed to be called via RPC from the associated Edge Function.
-- Version: 1.2 (Fixed subquery error)

-- Drop the function if it already exists to ensure a clean setup.
DROP FUNCTION IF EXISTS get_managed_subscriptions(uuid, text, jsonb, jsonb, boolean, boolean);

-- Create the final, highly optimized version of the function with the fix
CREATE OR REPLACE FUNCTION get_managed_subscriptions(
  p_user_id uuid,
  p_target_currency text DEFAULT 'CNY',
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_sorting jsonb DEFAULT '{"field": "nextBillingDate", "order": "asc"}'::jsonb,
  p_include_categories boolean DEFAULT true,
  p_include_payment_methods boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  final_result jsonb;
BEGIN
  WITH 
  -- Step 1: Get the latest exchange rates with robust deduplication.
  -- FIX: Use LEAST/GREATEST to canonicalize the currency pair, preventing duplicates.
  latest_rates AS (
    SELECT DISTINCT ON (LEAST(from_currency, to_currency), GREATEST(from_currency, to_currency))
      from_currency,
      to_currency,
      rate
    FROM exchange_rates
    ORDER BY LEAST(from_currency, to_currency), GREATEST(from_currency, to_currency), date DESC
  ),
  rate_map AS (
    SELECT from_currency || '_' || to_currency AS key, rate AS value FROM latest_rates
    UNION ALL
    -- FIX: Also prevent creating inverse for same-currency rates.
    SELECT to_currency || '_' || from_currency AS key, 1.0 / rate AS value FROM latest_rates WHERE rate != 0 AND from_currency != to_currency
  ),
  -- Step 2: Filter subscriptions and perform calculations in a CTE.
  filtered_subscriptions AS (
    SELECT
      s.*,
      c.value as category_value,
      c.label as category_label,
      pm.value as payment_method_value,
      pm.label as payment_method_label,
      ROUND(
        (s.amount * COALESCE((SELECT value FROM rate_map WHERE key = s.currency || '_' || p_target_currency), 1.0))::numeric, 2
      ) AS "convertedAmount"
    FROM subscriptions s
    LEFT JOIN categories c ON s.category_id = c.id
    LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
    WHERE s.user_id = p_user_id
      AND (p_filters->>'status' IS NULL OR p_filters->>'status' = 'all' OR
          (p_filters->>'status' = 'active' AND s.status != 'cancelled') OR
          (s.status = (p_filters->>'status')))
      AND (jsonb_array_length(p_filters->'categories') IS NULL OR c.value = ANY(SELECT jsonb_array_elements_text(p_filters->'categories')))
      AND (jsonb_array_length(p_filters->'billingCycles') IS NULL OR s.billing_cycle = ANY(SELECT jsonb_array_elements_text(p_filters->'billingCycles')))
      AND (p_filters->>'searchTerm' IS NULL OR p_filters->>'searchTerm' = '' OR s.name ILIKE '%' || (p_filters->>'searchTerm') || '%' OR s.plan ILIKE '%' || (p_filters->>'searchTerm') || '%')
  ),
  -- Step 3: Use Window Functions to calculate summaries.
  subscriptions_with_summary AS (
    SELECT
      *,
      COUNT(*) OVER () as "totalSubscriptions",
      SUM(CASE WHEN status != 'cancelled' THEN 1 ELSE 0 END) OVER () as "activeSubscriptions",
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) OVER () as "cancelledSubscriptions",
      ROUND(SUM(CASE WHEN status != 'cancelled' THEN
        CASE
          WHEN billing_cycle = 'monthly' THEN "convertedAmount"
          WHEN billing_cycle = 'yearly' THEN "convertedAmount" / 12.0
          WHEN billing_cycle = 'quarterly' THEN "convertedAmount" / 3.0
          ELSE "convertedAmount"
        END ELSE 0 END) OVER (), 2) as "totalMonthlySpending",
      ROUND(SUM(CASE WHEN status != 'cancelled' THEN
        CASE
          WHEN billing_cycle = 'monthly' THEN "convertedAmount" * 12.0
          WHEN billing_cycle = 'yearly' THEN "convertedAmount"
          WHEN billing_cycle = 'quarterly' THEN "convertedAmount" * 4.0
          ELSE "convertedAmount" * 12.0
        END ELSE 0 END) OVER (), 2) as "totalYearlySpending"
    FROM filtered_subscriptions
  )
  -- Step 4: Assemble the final JSON object.
  SELECT jsonb_build_object(
    'currency', p_target_currency,
    'timestamp', now()::text,
    'subscriptions', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', id, 'name', name, 'plan', plan, 'amount', amount, 'currency', currency,
          'convertedAmount', "convertedAmount", 'billingCycle', billing_cycle,
          'nextBillingDate', next_billing_date, 'lastBillingDate', last_billing_date,
          'status', status, 'categoryId', category_id, 'paymentMethodId', payment_method_id,
          'startDate', start_date, 'renewalType', renewal_type, 'notes', notes, 'website', website,
          'category', jsonb_build_object('id', category_id, 'value', category_value, 'label', category_label),
          'paymentMethod', jsonb_build_object('id', payment_method_id, 'value', payment_method_value, 'label', payment_method_label)
        ) ORDER BY
          CASE WHEN p_sorting->>'field' = 'name' THEN name END ASC,
          CASE WHEN p_sorting->>'field' = 'amount' THEN amount END ASC,
          CASE WHEN p_sorting->>'field' = 'nextBillingDate' THEN next_billing_date END ASC
      ), '[]'::jsonb)
      FROM subscriptions_with_summary
    ),
    'summary', (
      SELECT jsonb_build_object(
        'totalSubscriptions', COALESCE("totalSubscriptions", 0),
        'activeSubscriptions', COALESCE("activeSubscriptions", 0),
        'cancelledSubscriptions', COALESCE("cancelledSubscriptions", 0),
        'totalMonthlySpending', COALESCE("totalMonthlySpending", 0),
        'totalYearlySpending', COALESCE("totalYearlySpending", 0)
      )
      FROM subscriptions_with_summary
      LIMIT 1
    ),
    'categories', CASE WHEN p_include_categories THEN
      (SELECT COALESCE(jsonb_agg(json_build_object('id', id, 'value', value, 'label', label, 'is_default', is_default) ORDER BY label), '[]'::jsonb) FROM categories WHERE user_id = p_user_id)
      ELSE '[]'::jsonb END,
    'paymentMethods', CASE WHEN p_include_payment_methods THEN
      (SELECT COALESCE(jsonb_agg(json_build_object('id', id, 'value', value, 'label', label, 'is_default', is_default) ORDER BY label), '[]'::jsonb) FROM payment_methods WHERE user_id = p_user_id)
      ELSE '[]'::jsonb END
  )
  INTO final_result;

  RETURN final_result;
END;
$$;