DROP INDEX IF EXISTS scores_slug_score_created_at_idx;
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_slug_name_unique;
CREATE INDEX scores_slug_created_at_idx ON scores (slug, created_at DESC);
