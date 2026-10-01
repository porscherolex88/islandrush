-- Adventure audit history is append-only, like the ledger.
CREATE TRIGGER game_events_immutable BEFORE UPDATE OR DELETE ON game_events
  FOR EACH ROW EXECUTE FUNCTION lootbox_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER puzzle_piece_events_immutable BEFORE UPDATE OR DELETE ON puzzle_piece_events
  FOR EACH ROW EXECUTE FUNCTION lootbox_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER prize_unlock_attempts_immutable BEFORE UPDATE OR DELETE ON prize_unlock_attempts
  FOR EACH ROW EXECUTE FUNCTION lootbox_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER big_box_openings_immutable BEFORE UPDATE OR DELETE ON big_box_openings
  FOR EACH ROW EXECUTE FUNCTION lootbox_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER user_checkpoints_immutable BEFORE UPDATE OR DELETE ON user_checkpoints
  FOR EACH ROW EXECUTE FUNCTION lootbox_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER user_puzzles_immutable BEFORE UPDATE OR DELETE ON user_puzzles
  FOR EACH ROW EXECUTE FUNCTION lootbox_forbid_mutation();
