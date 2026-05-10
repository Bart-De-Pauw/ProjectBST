package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type Team struct {
	TeamID    int64  `json:"teamId"`
	TeamName  string `json:"teamName"`
	CaptainID *int64 `json:"captainId,omitempty"`
}

func (s *Store) ListTeams(ctx context.Context) ([]Team, error) {
	const q = `
		SELECT team_id, team_name, captain_id
		FROM team
		ORDER BY team_name
	`
	rows, err := s.DB.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Team
	for rows.Next() {
		var t Team
		if err := rows.Scan(&t.TeamID, &t.TeamName, &t.CaptainID); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) CreateTeam(ctx context.Context, name string, captainID *int64) (*Team, error) {
	const q = `
		INSERT INTO team (team_name, captain_id)
		VALUES ($1, $2)
		RETURNING team_id, team_name, captain_id
	`
	t := &Team{}
	err := s.DB.QueryRow(ctx, q, name, captainID).Scan(&t.TeamID, &t.TeamName, &t.CaptainID)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (s *Store) GetTeam(ctx context.Context, id int64) (*Team, error) {
	const q = `SELECT team_id, team_name, captain_id FROM team WHERE team_id=$1`
	t := &Team{}
	err := s.DB.QueryRow(ctx, q, id).Scan(&t.TeamID, &t.TeamName, &t.CaptainID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

func (s *Store) UpdateTeam(ctx context.Context, id int64, name string, captainID *int64) (*Team, error) {
	const q = `
		UPDATE team
		SET team_name=$2, captain_id=$3, updated_at=now()
		WHERE team_id=$1
		RETURNING team_id, team_name, captain_id
	`
	t := &Team{}
	err := s.DB.QueryRow(ctx, q, id, name, captainID).Scan(&t.TeamID, &t.TeamName, &t.CaptainID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

func (s *Store) PlayerExistsActive(ctx context.Context, playerID int64) (bool, error) {
	const q = `SELECT EXISTS (SELECT 1 FROM player WHERE player_id=$1 AND is_active)`
	var ok bool
	err := s.DB.QueryRow(ctx, q, playerID).Scan(&ok)
	return ok, err
}
