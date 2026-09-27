-- Ledger and audit history are append-only. Corrections are new reversing/adjusting entries.
CREATE OR REPLACE FUNCTION lootbox_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_NAME, TG_OP USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_immutable BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION lootbox_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER ledger_transactions_immutable BEFORE UPDATE OR DELETE ON ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION lootbox_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION lootbox_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER xp_transactions_immutable BEFORE UPDATE OR DELETE ON xp_transactions
  FOR EACH ROW EXECUTE FUNCTION lootbox_forbid_mutation();
