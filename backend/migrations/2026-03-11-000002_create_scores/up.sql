CREATE TABLE scores (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    score INTEGER NOT NULL,
    slug VARCHAR NOT NULL REFERENCES questions(slug) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT scores_slug_name_unique UNIQUE (slug, name)
);

CREATE INDEX scores_slug_score_created_at_idx ON scores (slug, score DESC, created_at DESC);
