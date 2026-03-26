-- Migration 005: Drop unused columns from live tables
-- Run AFTER taking a full database backup.
-- Safe to run multiple times (IF EXISTS guards every statement).

-- users.fcmtoken
-- Replaced by user_fcm_tokens table; column is dead code.
ALTER TABLE users DROP COLUMN IF EXISTS fcmtoken;

-- commissions: vendor split columns never used in any controller or query
ALTER TABLE commissions DROP COLUMN IF EXISTS vendoramount;
ALTER TABLE commissions DROP COLUMN IF EXISTS totalamount;
ALTER TABLE commissions DROP COLUMN IF EXISTS splitstatus;
ALTER TABLE commissions DROP COLUMN IF EXISTS settledat;
ALTER TABLE commissions DROP COLUMN IF EXISTS splitid;

-- vendors.kycdocuments: never written or read anywhere
ALTER TABLE vendors DROP COLUMN IF EXISTS kycdocuments;

-- audit_logs: adminname and ipaddress never written or read anywhere
ALTER TABLE audit_logs DROP COLUMN IF EXISTS adminname;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS ipaddress;
