-- Turn off player deposits site-wide (Maybank/CIMB bank transfer claims).
-- Re-enable later from Admin > System > Feature flags ("deposits").
INSERT INTO "feature_flags" ("key", "enabled", "description", "updated_at")
VALUES ('deposits', false, 'Manual deposits', now())
ON CONFLICT ("key") DO UPDATE
SET "enabled" = false, "updated_at" = now();
