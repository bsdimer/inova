-- Owners and tenants recorded by name only (D40, WHI-159).
--
-- The import brings in every resident of a building, and the pilot's
-- spreadsheets have owners and tenants without a phone or an e-mail. Such a
-- person becomes a named occupancy «без акаунт»: no account, no app access,
-- no invitation, until a verified contact is added later. 0007 allowed a
-- contactless row for an `occupant` only; it now allows any role, and a
-- person without an account must still have a name that is not blank.
-- Resident routes stay keyed on the account, so a name alone never signs in
-- or sees anything.

DO $$
DECLARE
  occupant_only text;
BEGIN
  SELECT conname INTO occupant_only
  FROM pg_constraint
  WHERE conrelid = 'occupancies'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%''occupant''::text) OR (user_id IS NOT NULL)%';
  IF occupant_only IS NOT NULL THEN
    EXECUTE format('ALTER TABLE occupancies DROP CONSTRAINT %I', occupant_only);
  END IF;
END
$$;

ALTER TABLE occupancies
  ADD CONSTRAINT occupancies_named_without_account
  CHECK (user_id IS NOT NULL OR length(btrim(first_name)) > 0);
