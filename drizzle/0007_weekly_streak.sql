-- Streak rewards now repeat every 7 days, so milestones past day 7 can never be reached.
UPDATE "streak_milestones" SET "active" = false WHERE "days" > 7;
