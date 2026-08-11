-- ============================================================================
-- New enum values for the symmetric credit economy.
--
-- Alone in their own migration on purpose. Postgres will not let a value added
-- by ALTER TYPE ... ADD VALUE be *used* in the transaction that added it, and
-- Supabase runs each migration file in one transaction. Splitting the additions
-- out means the next file can reference them freely.
-- ============================================================================

-- The two charges are the mirror image of the two earn reasons. They get their
-- own values rather than reusing 'pod_seat_spend' so the economy dashboard can
-- show both sides of the same transfer.
alter type ledger_reason add value if not exists 'install_charge';
alter type ledger_reason add value if not exists 'review_charge';

-- The paid pass: an entitlement with no app and an expiry, never consumed. It
-- is a window of time rather than a thing spent once.
alter type entitlement_kind add value if not exists 'unlimited';

-- Told to a developer whose balance ran out mid-pod. Their testers were still
-- paid; this is the message that says why the app stopped taking new work.
alter type notification_kind add value if not exists 'credits_exhausted';
