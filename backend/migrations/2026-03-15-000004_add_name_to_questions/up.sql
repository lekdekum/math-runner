ALTER TABLE questions
ADD COLUMN name VARCHAR NOT NULL DEFAULT '';

UPDATE questions
SET name = slug
WHERE name = '';
