package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type Match struct {
	MatchID   int64  `json:"matchId"`
	EventID   int64  `json:"eventId"`
	LaneNumber string `json:"laneNumber"`
	TeamAID   int64  `json:"teamAId"`
	TeamBID   int64  `json:"teamBId"`
}

func (s *Store) CreateMatch(ctx context.Context, eventID int64, lane string, teamA, teamB int64) (*Match, error) {
	const q = `
		INSERT INTO match (event_id, lane_number, team_a_id, team_b_id)
		VALUES ($1,$2,$3,$4)
		RETURNING match_id, event_id, lane_number, team_a_id, team_b_id
	`
	m := &Match{}
	err := s.DB.QueryRow(ctx, q, eventID, lane, teamA, teamB).Scan(&m.MatchID, &m.EventID, &m.LaneNumber, &m.TeamAID, &m.TeamBID)
	if err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Store) ListMatchesForEvent(ctx context.Context, eventID int64) ([]Match, error) {
	const q = `
		SELECT match_id, event_id, lane_number, team_a_id, team_b_id
		FROM match WHERE event_id=$1
		ORDER BY lane_number, match_id
	`
	rows, err := s.DB.Query(ctx, q, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Match
	for rows.Next() {
		var m Match
		if err := rows.Scan(&m.MatchID, &m.EventID, &m.LaneNumber, &m.TeamAID, &m.TeamBID); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) GetMatch(ctx context.Context, matchID int64) (*Match, error) {
	const q = `
		SELECT match_id, event_id, lane_number, team_a_id, team_b_id
		FROM match WHERE match_id=$1
	`
	m := &Match{}
	err := s.DB.QueryRow(ctx, q, matchID).Scan(&m.MatchID, &m.EventID, &m.LaneNumber, &m.TeamAID, &m.TeamBID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return m, nil
}

func (s *Store) TeamScheduledInEvent(ctx context.Context, eventID, teamID int64) (bool, error) {
	const q = `SELECT 1 FROM match WHERE event_id=$1 AND (team_a_id=$2 OR team_b_id=$2) LIMIT 1`
	var one int
	err := s.DB.QueryRow(ctx, q, eventID, teamID).Scan(&one)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) IsTeamEnrolledInSeason(ctx context.Context, seasonID, teamID int64) (bool, error) {
	const q = `SELECT 1 FROM season_team WHERE season_id=$1 AND team_id=$2 LIMIT 1`
	var one int
	err := s.DB.QueryRow(ctx, q, seasonID, teamID).Scan(&one)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) GetEventIDForMatch(ctx context.Context, matchID int64) (int64, error) {
	const q = `SELECT event_id FROM match WHERE match_id=$1`
	var eid int64
	err := s.DB.QueryRow(ctx, q, matchID).Scan(&eid)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrNotFound
		}
		return 0, err
	}
	return eid, nil
}
