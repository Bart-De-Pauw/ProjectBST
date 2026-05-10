package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type Season struct {
	SeasonID   int64      `json:"seasonId"`
	SeasonName string     `json:"seasonName"`
	StartDate  *time.Time `json:"startDate,omitempty"`
	EndDate    *time.Time `json:"endDate,omitempty"`
}

func (s *Store) CreateSeason(ctx context.Context, name string, start, end *time.Time) (*Season, error) {
	const q = `
		INSERT INTO season_competition (season_name, start_date, end_date)
		VALUES ($1, $2, $3)
		RETURNING season_id, season_name, start_date, end_date
	`
	out := &Season{}
	err := s.DB.QueryRow(ctx, q, name, start, end).Scan(&out.SeasonID, &out.SeasonName, &out.StartDate, &out.EndDate)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) ListSeasons(ctx context.Context) ([]Season, error) {
	const q = `
		SELECT season_id, season_name, start_date, end_date
		FROM season_competition
		ORDER BY season_name
	`
	rows, err := s.DB.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Season
	for rows.Next() {
		var se Season
		if err := rows.Scan(&se.SeasonID, &se.SeasonName, &se.StartDate, &se.EndDate); err != nil {
			return nil, err
		}
		out = append(out, se)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if out == nil {
		out = []Season{}
	}
	return out, nil
}

func (s *Store) GetSeason(ctx context.Context, id int64) (*Season, error) {
	const q = `SELECT season_id, season_name, start_date, end_date FROM season_competition WHERE season_id=$1`
	out := &Season{}
	err := s.DB.QueryRow(ctx, q, id).Scan(&out.SeasonID, &out.SeasonName, &out.StartDate, &out.EndDate)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return out, nil
}

func (s *Store) AddSeasonTeam(ctx context.Context, seasonID, teamID int64) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const ins = `
		INSERT INTO season_team (season_id, team_id, season_points)
		VALUES ($1, $2, 0)
		ON CONFLICT DO NOTHING
	`
	if _, err := tx.Exec(ctx, ins, seasonID, teamID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) RemoveSeasonTeam(ctx context.Context, seasonID, teamID int64) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `DELETE FROM player_team_affiliation WHERE season_id=$1 AND team_id=$2`, seasonID, teamID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM season_team WHERE season_id=$1 AND team_id=$2`, seasonID, teamID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) UpsertPlayerAffiliation(ctx context.Context, seasonID, playerID, teamID int64, isCaptain bool) error {
	const q = `
		INSERT INTO player_team_affiliation (season_id, player_id, team_id, is_captain)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (season_id, player_id)
		DO UPDATE SET team_id=EXCLUDED.team_id, is_captain=EXCLUDED.is_captain
	`
	_, err := s.DB.Exec(ctx, q, seasonID, playerID, teamID, isCaptain)
	return err
}

type SeasonTeamRow struct {
	SeasonID     int64 `json:"seasonId"`
	TeamID       int64 `json:"teamId"`
	SeasonPoints int   `json:"seasonPoints"`
}

func (s *Store) ListSeasonTeams(ctx context.Context, seasonID int64) ([]SeasonTeamRow, error) {
	const q = `
		SELECT season_id, team_id, season_points
		FROM season_team
		WHERE season_id=$1
		ORDER BY team_id
	`
	rows, err := s.DB.Query(ctx, q, seasonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SeasonTeamRow
	for rows.Next() {
		var r SeasonTeamRow
		if err := rows.Scan(&r.SeasonID, &r.TeamID, &r.SeasonPoints); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

type AffiliationRow struct {
	SeasonID  int64 `json:"seasonId"`
	PlayerID  int64 `json:"playerId"`
	TeamID    int64 `json:"teamId"`
	IsCaptain bool  `json:"isCaptain"`
}

func (s *Store) ListAffiliations(ctx context.Context, seasonID int64) ([]AffiliationRow, error) {
	const q = `
		SELECT season_id, player_id, team_id, is_captain
		FROM player_team_affiliation
		WHERE season_id=$1
		ORDER BY team_id, player_id
	`
	rows, err := s.DB.Query(ctx, q, seasonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AffiliationRow
	for rows.Next() {
		var r AffiliationRow
		if err := rows.Scan(&r.SeasonID, &r.PlayerID, &r.TeamID, &r.IsCaptain); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) SeasonContainsTeam(ctx context.Context, seasonID, teamID int64) (bool, error) {
	const q = `SELECT EXISTS (SELECT 1 FROM season_team WHERE season_id=$1 AND team_id=$2)`
	var ok bool
	err := s.DB.QueryRow(ctx, q, seasonID, teamID).Scan(&ok)
	return ok, err
}
