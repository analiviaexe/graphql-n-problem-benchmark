CREATE TABLE IF NOT EXISTS titles (
    tconst VARCHAR(12) PRIMARY KEY,
    title_type VARCHAR(50),
    primary_title TEXT NOT NULL,
    original_title TEXT,
    is_adult BOOLEAN DEFAULT FALSE,
    start_year INT,
    end_year INT,
    runtime_minutes INT,
    genres TEXT
);

CREATE TABLE IF NOT EXISTS ratings (
    tconst VARCHAR(12) PRIMARY KEY REFERENCES titles(tconst) ON DELETE CASCADE,
    average_rating NUMERIC(3,1),
    num_votes INT
);

CREATE TABLE IF NOT EXISTS names (
    nconst VARCHAR(12) PRIMARY KEY,
    primary_name TEXT NOT NULL,
    birth_year INT,
    death_year INT,
    primary_profession TEXT,
    known_for_titles TEXT
);

CREATE TABLE IF NOT EXISTS principals (
    id SERIAL PRIMARY KEY,
    tconst VARCHAR(12) NOT NULL REFERENCES titles(tconst) ON DELETE CASCADE,
    ordering INT NOT NULL,
    nconst VARCHAR(12) NOT NULL REFERENCES names(nconst) ON DELETE CASCADE,
    category VARCHAR(100),
    job TEXT,
    characters TEXT
);

CREATE INDEX IF NOT EXISTS idx_principals_tconst ON principals(tconst);
CREATE INDEX IF NOT EXISTS idx_principals_nconst ON principals(nconst);
CREATE INDEX IF NOT EXISTS idx_ratings_tconst ON ratings(tconst);
