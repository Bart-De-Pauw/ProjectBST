package store

import (
	"context"
)

type TeamLeaderboardRow struct {
	TeamID       int64  `json:"teamId"`
	TeamName     string `json:"teamName"`
	SeasonPoints int    `json:"seasonPoints"`
}

func (s *Store) TeamLeaderboard(ctx context.Context, seasonID int64) ([]TeamLeaderboardRow, error) {
	const q = `
		SELECT t.team_id, t.team_name, st.season_points
		FROM season_team st
		JOIN team t ON t.team_id = st.team_id
		WHERE st.season_id = $1
		ORDER BY st.season_points DESC, t.team_name ASC
	`
	rows, err := s.DB.Query(ctx, q, seasonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TeamLeaderboardRow
	for rows.Next() {
		var r TeamLeaderboardRow
		if err := rows.Scan(&r.TeamID, &r.TeamName, &r.SeasonPoints); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

type PlayerScratchLeaderboardRow struct {
	PlayerID    int64  `json:"playerId"`
	FullName    string `json:"fullName"`
	TotalScratch int64 `json:"totalScratch"`
}

func (s *Store) PlayerScratchLeaderboard(ctx context.Context, seasonID int64, gender string) ([]PlayerScratchLeaderboardRow, error) {
	const q = `
		SELECT p.player_id, p.full_name, COALESCE(SUM(mpg.scratch_score), 0)::bigint AS total_scratch
		FROM player p
		JOIN match_player_game mpg ON mpg.player_id = p.player_id
		JOIN match m ON m.match_id = mpg.match_id
		JOIN event e ON e.event_id = m.event_id
		WHERE e.season_id = $1 AND e.finalized = true AND p.gender::text = $2
		GROUP BY p.player_id, p.full_name
		HAVING COALESCE(SUM(mpg.scratch_score), 0) > 0
		ORDER BY total_scratch DESC, p.full_name ASC
	`
	rows, err := s.DB.Query(ctx, q, seasonID, gender)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PlayerScratchLeaderboardRow
	for rows.Next() {
		var r PlayerScratchLeaderboardRow
		if err := rows.Scan(&r.PlayerID, &r.FullName, &r.TotalScratch); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
