CREATE TABLE scores (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    score INTEGER NOT NULL,
    slug VARCHAR NOT NULL REFERENCES questions(slug) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX scores_slug_created_at_idx ON scores (slug, created_at DESC);
