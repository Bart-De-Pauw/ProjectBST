package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"projectbst/api/internal/scoring"
)

func listMatchesForEventTx(ctx context.Context, tx pgx.Tx, eventID int64) ([]Match, error) {
	const q = `
		SELECT match_id, event_id, lane_number, team_a_id, team_b_id
		FROM match WHERE event_id=$1
		ORDER BY lane_number, match_id
	`
	rows, err := tx.Query(ctx, q, eventID)
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

func listRosterTx(ctx context.Context, tx pgx.Tx, matchID int64) ([]RosterRow, error) {
	const q = `
		SELECT match_id, team_id, player_id, slot_position
		FROM match_roster WHERE match_id=$1
		ORDER BY team_id, slot_position
	`
	rows, err := tx.Query(ctx, q, matchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []RosterRow
	for rows.Next() {
		var r RosterRow
		if err := rows.Scan(&r.MatchID, &r.TeamID, &r.PlayerID, &r.SlotPosition); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func listScoresTx(ctx context.Context, tx pgx.Tx, matchID int64) ([]MatchPlayerGameRow, error) {
	const q = `
		SELECT match_id, team_id, player_id, slot_position, game_number, scratch_score, hdcp_at_event
		FROM match_player_game WHERE match_id=$1
		ORDER BY game_number, team_id, slot_position
	`
	rows, err := tx.Query(ctx, q, matchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MatchPlayerGameRow
	for rows.Next() {
		var r MatchPlayerGameRow
		if err := rows.Scan(&r.MatchID, &r.TeamID, &r.PlayerID, &r.SlotPosition, &r.GameNumber, &r.ScratchScore, &r.HdcpAtEvent); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func matchApprovalsEffectiveTx(ctx context.Context, tx pgx.Tx, matchID int64, teamAID, teamBID int64) (aOK bool, bOK bool, err error) {
	const q = `
		SELECT team_id,
		       (override_approved_at IS NOT NULL)
		       OR (approved_at IS NOT NULL AND revoked_at IS NULL)
		FROM match_approval WHERE match_id=$1 AND team_id IN ($2,$3)
	`
	rows, err := tx.Query(ctx, q, matchID, teamAID, teamBID)
	if err != nil {
		return false, false, err
	}
	defer rows.Close()
	for rows.Next() {
		var tid int64
		var ok bool
		if err := rows.Scan(&tid, &ok); err != nil {
			return false, false, err
		}
		switch tid {
		case teamAID:
			aOK = ok
		case teamBID:
			bOK = ok
		}
	}
	return aOK, bOK, rows.Err()
}

func sumTeamPins(rows []MatchPlayerGameRow, teamID int64) (scratch int, hdcp int) {
	for _, rw := range rows {
		if rw.TeamID == teamID {
			scratch += int(rw.ScratchScore)
			hdcp += int(rw.HdcpAtEvent)
		}
	}
	return scratch, hdcp
}

// FinalizeEvent validates approvals + complete scores, persists match_result rows, marks event finalized, and recomputes season_team.season_points.
func (s *Store) FinalizeEvent(ctx context.Context, eventID int64, presidentID int64) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var finalized bool
	var seasonID int64
	err = tx.QueryRow(ctx, `SELECT finalized, season_id FROM event WHERE event_id=$1 FOR UPDATE`, eventID).Scan(&finalized, &seasonID)
	if err != nil {
		return err
	}
	if finalized {
		return fmt.Errorf("event already finalized")
	}

	matches, err := listMatchesForEventTx(ctx, tx, eventID)
	if err != nil {
		return err
	}

	for _, m := range matches {
		aOK, bOK, err := matchApprovalsEffectiveTx(ctx, tx, m.MatchID, m.TeamAID, m.TeamBID)
		if err != nil {
			return err
		}
		if !aOK || !bOK {
			return fmt.Errorf("match %d pending approvals", m.MatchID)
		}
		roster, err := listRosterTx(ctx, tx, m.MatchID)
		if err != nil {
			return err
		}
		scores, err := listScoresTx(ctx, tx, m.MatchID)
		if err != nil {
			return err
		}
		ms, err := BuildMatchScoresFromRows(m.TeamAID, m.TeamBID, roster, scores)
		if err != nil {
			return fmt.Errorf("match %d scores: %w", m.MatchID, err)
		}
		tot := scoring.ScoreMatch(ms)
		if tot.EveningPending {
			return fmt.Errorf("match %d has incomplete scoring", m.MatchID)
		}
	}

	var gen int
	err = tx.QueryRow(ctx, `
		UPDATE event SET finalize_generation = finalize_generation + 1, updated_at=now()
		WHERE event_id=$1 AND finalized=false
		RETURNING finalize_generation
	`, eventID).Scan(&gen)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM match_result mr USING match m
		WHERE mr.match_id = m.match_id AND m.event_id=$1
	`, eventID); err != nil {
		return err
	}

	for _, m := range matches {
		roster, err := listRosterTx(ctx, tx, m.MatchID)
		if err != nil {
			return err
		}
		scores, err := listScoresTx(ctx, tx, m.MatchID)
		if err != nil {
			return err
		}
		ms, err := BuildMatchScoresFromRows(m.TeamAID, m.TeamBID, roster, scores)
		if err != nil {
			return err
		}
		tot := scoring.ScoreMatch(ms)
		sa, ha := sumTeamPins(scores, m.TeamAID)
		sb, hb := sumTeamPins(scores, m.TeamBID)

		_, err = tx.Exec(ctx, `
			INSERT INTO match_result (
				match_id, version, computed_by, team_a_points, team_b_points,
				team_a_total_scratch, team_b_total_scratch, team_a_total_hdcp, team_b_total_hdcp
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		`, m.MatchID, gen, presidentID, tot.TeamAPoints(), tot.TeamBPoints(), sa, sb, ha, hb)
		if err != nil {
			return err
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE event SET finalized=true, finalized_at=now(), finalized_by=$2, updated_at=now()
		WHERE event_id=$1
	`, eventID, presidentID); err != nil {
		return err
	}

	if err := s.recomputeSeasonTeamPointsTx(ctx, tx, seasonID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// ReopenEvent deletes persisted results for the event, clears finalized state, and recomputes standings.
func (s *Store) ReopenEvent(ctx context.Context, eventID int64, presidentID int64, reason string) error {
	if reason == "" {
		return fmt.Errorf("reopen reason required")
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var finalized bool
	var seasonID int64
	err = tx.QueryRow(ctx, `SELECT finalized, season_id FROM event WHERE event_id=$1 FOR UPDATE`, eventID).Scan(&finalized, &seasonID)
	if err != nil {
		return err
	}
	if !finalized {
		return fmt.Errorf("event is not finalized")
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM match_result mr USING match m
		WHERE mr.match_id = m.match_id AND m.event_id=$1
	`, eventID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE event
		SET finalized=false, finalized_at=NULL, finalized_by=NULL,
		    reopened_at=now(), reopened_by=$2, reopen_reason=$3, updated_at=now()
		WHERE event_id=$1
	`, eventID, presidentID, reason); err != nil {
		return err
	}

	if err := s.recomputeSeasonTeamPointsTx(ctx, tx, seasonID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
