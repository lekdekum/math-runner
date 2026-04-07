UPDATE scores AS target
SET
    score = aggregated.best_score,
    created_at = aggregated.last_attempt_at
FROM (
    SELECT slug, name, MAX(score) AS best_score, MAX(created_at) AS last_attempt_at
    FROM scores
    GROUP BY slug, name
) AS aggregated
WHERE target.slug = aggregated.slug
  AND target.name = aggregated.name
  AND target.id = (
      SELECT candidate.id
      FROM scores AS candidate
      WHERE candidate.slug = target.slug
        AND candidate.name = target.name
      ORDER BY candidate.created_at DESC, candidate.id DESC
      LIMIT 1
  );

DELETE FROM scores AS duplicate
WHERE duplicate.id NOT IN (
    SELECT DISTINCT ON (slug, name) keeper.id
    FROM scores AS keeper
    ORDER BY keeper.slug, keeper.name, keeper.created_at DESC, keeper.id DESC
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'scores_slug_name_unique'
    ) THEN
        ALTER TABLE scores
        ADD CONSTRAINT scores_slug_name_unique UNIQUE (slug, name);
    END IF;
END $$;

DROP INDEX IF EXISTS scores_slug_created_at_idx;
DROP INDEX IF EXISTS scores_slug_score_created_at_idx;
CREATE INDEX scores_slug_score_created_at_idx ON scores (slug, score DESC, created_at DESC);
