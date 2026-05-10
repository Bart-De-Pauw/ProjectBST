-- Core schema + operational tables (auth, approvals, results, email logs).

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN
    CREATE TYPE gender AS ENUM ('Male', 'Female');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE role AS ENUM ('Player', 'Captain', 'President');
  END IF;
END$$;

-- Player
CREATE TABLE IF NOT EXISTS player (
  player_id         BIGSERIAL PRIMARY KEY,
  full_name         TEXT NOT NULL,
  gender            gender NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,

  username          TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,

  email             TEXT,
  email_opt_in      BOOLEAN NOT NULL DEFAULT TRUE,
  email_opt_in_updated_at TIMESTAMPTZ,

  role              role NOT NULL DEFAULT 'Player',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team
CREATE TABLE IF NOT EXISTS team (
  team_id     BIGSERIAL PRIMARY KEY,
  team_name   TEXT NOT NULL UNIQUE,
  captain_id  BIGINT REFERENCES player(player_id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Season
CREATE TABLE IF NOT EXISTS season_competition (
  season_id    BIGSERIAL PRIMARY KEY,
  season_name  TEXT NOT NULL UNIQUE,
  start_date   DATE,
  end_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams participating in season (season-scoped points)
CREATE TABLE IF NOT EXISTS season_team (
  season_id     BIGINT NOT NULL REFERENCES season_competition(season_id) ON DELETE CASCADE,
  team_id       BIGINT NOT NULL REFERENCES team(team_id) ON DELETE RESTRICT,
  season_points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (season_id, team_id)
);

-- Player membership in a season team (one team per season per player)
CREATE TABLE IF NOT EXISTS player_team_affiliation (
  season_id  BIGINT NOT NULL REFERENCES season_competition(season_id) ON DELETE CASCADE,
  player_id  BIGINT NOT NULL REFERENCES player(player_id) ON DELETE RESTRICT,
  team_id    BIGINT NOT NULL REFERENCES team(team_id) ON DELETE RESTRICT,
  is_captain BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (season_id, player_id),
  UNIQUE (season_id, team_id, player_id)
);

-- Event (evening)
CREATE TABLE IF NOT EXISTS event (
  event_id     BIGSERIAL PRIMARY KEY,
  season_id    BIGINT NOT NULL REFERENCES season_competition(season_id) ON DELETE CASCADE,
  event_date   DATE NOT NULL,

  finalized    BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at TIMESTAMPTZ,
  finalized_by BIGINT REFERENCES player(player_id),

  reopened_at  TIMESTAMPTZ,
  reopened_by  BIGINT REFERENCES player(player_id),
  reopen_reason TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (season_id, event_date)
);

-- Match (calendar entry: opponent + lane for an event)
CREATE TABLE IF NOT EXISTS match (
  match_id    BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES event(event_id) ON DELETE CASCADE,
  lane_number TEXT NOT NULL,
  team_a_id   BIGINT NOT NULL REFERENCES team(team_id) ON DELETE RESTRICT,
  team_b_id   BIGINT NOT NULL REFERENCES team(team_id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT match_distinct_teams CHECK (team_a_id <> team_b_id)
);

-- Enforce: a team appears at most once per event
CREATE UNIQUE INDEX IF NOT EXISTS ux_match_event_team_a ON match(event_id, team_a_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_match_event_team_b ON match(event_id, team_b_id);

-- Match roster (3 slots per team)
CREATE TABLE IF NOT EXISTS match_roster (
  match_id      BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
  team_id       BIGINT NOT NULL REFERENCES team(team_id) ON DELETE RESTRICT,
  player_id     BIGINT NOT NULL REFERENCES player(player_id) ON DELETE RESTRICT,
  slot_position SMALLINT NOT NULL CHECK (slot_position IN (1,2,3)),
  PRIMARY KEY (match_id, team_id, slot_position),
  UNIQUE (match_id, team_id, player_id)
);

-- Raw scoring per player per game (3 games)
CREATE TABLE IF NOT EXISTS match_player_game (
  match_player_game_id BIGSERIAL PRIMARY KEY,
  match_id      BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
  team_id       BIGINT NOT NULL REFERENCES team(team_id) ON DELETE RESTRICT,
  player_id     BIGINT NOT NULL REFERENCES player(player_id) ON DELETE RESTRICT,
  slot_position SMALLINT NOT NULL CHECK (slot_position IN (1,2,3)),
  game_number   SMALLINT NOT NULL CHECK (game_number IN (1,2,3)),
  scratch_score SMALLINT NOT NULL CHECK (scratch_score >= 0 AND scratch_score <= 300),
  hdcp_at_event SMALLINT NOT NULL CHECK (hdcp_at_event >= 0 AND hdcp_at_event <= 300),
  submitted_by_captain_id BIGINT REFERENCES player(player_id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    BIGINT REFERENCES player(player_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (match_id, team_id, player_id, game_number)
);

-- Approvals (one per match+team)
CREATE TABLE IF NOT EXISTS match_approval (
  match_id   BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
  team_id    BIGINT NOT NULL REFERENCES team(team_id) ON DELETE RESTRICT,

  approved_at TIMESTAMPTZ,
  approved_by BIGINT REFERENCES player(player_id),

  revoked_at  TIMESTAMPTZ,
  revoked_by  BIGINT REFERENCES player(player_id),
  revoke_reason TEXT,

  override_approved_at TIMESTAMPTZ,
  override_approved_by BIGINT REFERENCES player(player_id),
  override_reason TEXT,

  PRIMARY KEY (match_id, team_id)
);

-- Persisted official results (versioned per match)
CREATE TABLE IF NOT EXISTS match_result (
  match_id    BIGINT NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  computed_by BIGINT REFERENCES player(player_id),

  team_a_points INTEGER NOT NULL,
  team_b_points INTEGER NOT NULL,

  -- optional transparency totals (can be null until we compute them)
  team_a_total_scratch INTEGER,
  team_b_total_scratch INTEGER,
  team_a_total_hdcp INTEGER,
  team_b_total_hdcp INTEGER,

  PRIMARY KEY (match_id, version)
);

-- Email log (dedupe by event/version/email)
CREATE TABLE IF NOT EXISTS email_log (
  event_id       BIGINT NOT NULL REFERENCES event(event_id) ON DELETE CASCADE,
  digest_version INTEGER NOT NULL,
  email          TEXT NOT NULL,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT NOT NULL DEFAULT 'sent',
  error          TEXT,
  PRIMARY KEY (event_id, digest_version, email)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS ix_event_season_date ON event(season_id, event_date);
CREATE INDEX IF NOT EXISTS ix_match_event_lane ON match(event_id, lane_number);
CREATE INDEX IF NOT EXISTS ix_mpg_match_team_game ON match_player_game(match_id, team_id, game_number);
CREATE INDEX IF NOT EXISTS ix_player_gender ON player(gender);

