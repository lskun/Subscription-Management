-- This script defines the production-ready PostgreSQL function for processing subscription renewals.
-- It includes logic to prevent double payments and ensures accurate payment history logging.
-- Version: 1.3 (Production Ready)

-- Drop the function if it already exists to ensure a clean setup.
DROP FUNCTION IF EXISTS process_subscription_renewal(uuid, uuid);

-- Create the final, production-grade RPC function
CREATE OR REPLACE FUNCTION process_subscription_renewal(
  p_subscription_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub record;
  new_next_billing_date date;
  new_last_billing_date date := current_date;
  new_billing_period_end date;
BEGIN
  -- Step 1: Lock and retrieve the current subscription details
  SELECT * INTO sub FROM public.subscriptions
  WHERE id = p_subscription_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found or user mismatch';
  END IF;

  -- FIX #2: Prevent double payments. If the next billing date is still in the future, disallow renewal.
  IF sub.next_billing_date IS NOT NULL AND sub.next_billing_date > new_last_billing_date THEN
    RAISE EXCEPTION 'Subscription is already paid for the current period. Next payment is on %', sub.next_billing_date;
  END IF;

  -- Step 2: Calculate the new billing period end and the next billing date
  new_billing_period_end := CASE
    WHEN sub.billing_cycle = 'monthly' THEN (new_last_billing_date + interval '1 month' - interval '1 day')::date
    WHEN sub.billing_cycle = 'yearly' THEN (new_last_billing_date + interval '1 year' - interval '1 day')::date
    WHEN sub.billing_cycle = 'quarterly' THEN (new_last_billing_date + interval '3 months' - interval '1 day')::date
    ELSE (new_last_billing_date + interval '1 month' - interval '1 day')::date
  END;

  new_next_billing_date := (new_billing_period_end + interval '1 day')::date;

  -- Step 3: Create an accurate payment record in payment_history
  -- FIX #1: Corrected the logic for billing_period_start and billing_period_end
  INSERT INTO public.payment_history (user_id, subscription_id, payment_date, amount_paid, currency, billing_period_start, billing_period_end, status)
  VALUES (
    p_user_id,
    p_subscription_id,
    new_last_billing_date,
    sub.amount,
    sub.currency,
    new_last_billing_date, -- The start of the period covered by this payment is today
    new_billing_period_end, -- The end of the period covered by this payment is in the future
    'succeeded'
  );

  -- Step 4: Atomically update the subscriptions table
  UPDATE public.subscriptions
  SET
    last_billing_date = new_last_billing_date,
    next_billing_date = new_next_billing_date,
    status = 'active'
  WHERE id = p_subscription_id;

  -- Step 5: Return the updated dates for the client to display
  RETURN jsonb_build_object(
    'newLastBilling', new_last_billing_date,
    'newNextBilling', new_next_billing_date
  );
END;
$$;
