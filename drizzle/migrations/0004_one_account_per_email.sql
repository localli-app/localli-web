-- Hand-written: a partial, case-insensitive unique index, which drizzle-kit
-- cannot express.
--
-- resolveOrCreateAccount() looks an account up by staff email. Without a
-- uniqueness guarantee that lookup is ambiguous, and two magic links opened at
-- the same moment create TWO businesses for one person — the exact duplicate
-- the identity rules exist to prevent.
--
-- Scoped to active staff so a deactivated member's address can be reused, and
-- lower()ed because email comparison is case-insensitive in practice even
-- though the local part is technically case-sensitive.
--
-- CONSEQUENCE, deliberate for v1: one person cannot be staff at two businesses.
-- Multi-business membership is not in scope (planning/04-scope-and-mvp.md), and
-- an explicit conflict is better than silently picking whichever row sorts
-- first. Revisit by moving identity onto its own table if that changes.
CREATE UNIQUE INDEX IF NOT EXISTS staff_email_unique_idx
  ON staff (lower(email))
  WHERE email IS NOT NULL AND is_active;
