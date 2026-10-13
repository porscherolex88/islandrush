UPDATE "mission_definitions" SET "active" = false WHERE "action" = 'DAILY_EVENT';--> statement-breakpoint
UPDATE "app_config"
SET "value" = ("value" - 'eventTitle' - 'eventDescription' - 'eventIcon' - 'eventPoolId')
  || jsonb_build_object('missionKeys', COALESCE((SELECT jsonb_agg(k) FROM jsonb_array_elements_text("value"->'missionKeys') AS k WHERE k <> 'event'), '[]'::jsonb))
WHERE "key" = 'daily_defaults';
