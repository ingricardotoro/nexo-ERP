-- Data migration: assign systemPurpose to standard NIIF accounts
-- This sets the system_purpose for well-known account codes across ALL companies.
-- Companies with custom chart of accounts can manually reassign via the UI.

UPDATE accounts SET system_purpose = 'ACCOUNTS_RECEIVABLE'
WHERE code = '1103' AND system_purpose IS NULL AND is_active = true;

UPDATE accounts SET system_purpose = 'ISV_PAYABLE'
WHERE code = '2102' AND system_purpose IS NULL AND is_active = true;

UPDATE accounts SET system_purpose = 'SALES_REVENUE'
WHERE code = '4101' AND system_purpose IS NULL AND is_active = true;
