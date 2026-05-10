package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type RosterRow struct {
	MatchID      int64 `json:"matchId"`
	TeamID       int64 `json:"teamId"`
	PlayerID     int64 `json:"playerId"`
	SlotPosition int16 `json:"slotPosition"`
}

func (s *Store) UpsertMatchRoster(ctx context.Context, matchID, teamID, playerID int64, slot int16) error {
	const q = `
		INSERT INTO match_roster (match_id, team_id, player_id, slot_position)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (match_id, team_id, slot_position)
		DO UPDATE SET player_id=EXCLUDED.player_id
	`
	_, err := s.DB.Exec(ctx, q, matchID, teamID, playerID, slot)
	return err
}

func (s *Store) ListMatchRoster(ctx context.Context, matchID int64) ([]RosterRow, error) {
	const q = `
		SELECT match_id, team_id, player_id, slot_position
		FROM match_roster WHERE match_id=$1
		ORDER BY team_id, slot_position
	`
	rows, err := s.DB.Query(ctx, q, matchID)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if out == nil {
		out = []RosterRow{}
	}
	return out, nil
}

type MatchPlayerGameRow struct {
	MatchID       int64 `json:"matchId"`
	TeamID        int64 `json:"teamId"`
	PlayerID      int64 `json:"playerId"`
	SlotPosition  int16 `json:"slotPosition"`
	GameNumber    int16 `json:"gameNumber"`
	ScratchScore  int16 `json:"scratchScore"`
	HdcpAtEvent   int16 `json:"hdcpAtEvent"`
}

func (s *Store) UpsertMatchPlayerGame(ctx context.Context, matchID, teamID, playerID int64, slot int16, game int16, scratch, hdcp int16, submittedBy int64) error {
	const q = `
		INSERT INTO match_player_game (
			match_id, team_id, player_id, slot_position, game_number,
			scratch_score, hdcp_at_event, submitted_by_captain_id, updated_by
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
		ON CONFLICT (match_id, team_id, player_id, game_number)
		DO UPDATE SET
			slot_position=EXCLUDED.slot_position,
			scratch_score=EXCLUDED.scratch_score,
			hdcp_at_event=EXCLUDED.hdcp_at_event,
			submitted_by_captain_id=EXCLUDED.submitted_by_captain_id,
			updated_at=now(),
			updated_by=EXCLUDED.updated_by
	`
	_, err := s.DB.Exec(ctx, q, matchID, teamID, playerID, slot, game, scratch, hdcp, submittedBy)
	return err
}

func (s *Store) ListMatchPlayerGames(ctx context.Context, matchID int64) ([]MatchPlayerGameRow, error) {
	const q = `
		SELECT match_id, team_id, player_id, slot_position, game_number, scratch_score, hdcp_at_event
		FROM match_player_game WHERE match_id=$1
		ORDER BY game_number, team_id, slot_position
	`
	rows, err := s.DB.Query(ctx, q, matchID)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if out == nil {
		out = []MatchPlayerGameRow{}
	}
	return out, nil
}

type MatchApprovalRow struct {
	MatchID            int64      `json:"matchId"`
	TeamID             int64      `json:"teamId"`
	ApprovedAt         *time.Time `json:"approvedAt,omitempty"`
	ApprovedBy         *int64     `json:"approvedBy,omitempty"`
	RevokedAt          *time.Time `json:"revokedAt,omitempty"`
	RevokedBy          *int64     `json:"revokedBy,omitempty"`
	RevokeReason       *string    `json:"revokeReason,omitempty"`
	OverrideApprovedAt *time.Time `json:"overrideApprovedAt,omitempty"`
	OverrideApprovedBy *int64     `json:"overrideApprovedBy,omitempty"`
	OverrideReason     *string    `json:"overrideReason,omitempty"`
}

func (s *Store) ListMatchApprovals(ctx context.Context, matchID int64) ([]MatchApprovalRow, error) {
	const q = `
		SELECT match_id, team_id, approved_at, approved_by, revoked_at, revoked_by, revoke_reason,
		       override_approved_at, override_approved_by, override_reason
		FROM match_approval WHERE match_id=$1 ORDER BY team_id
	`
	rows, err := s.DB.Query(ctx, q, matchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MatchApprovalRow
	for rows.Next() {
		var r MatchApprovalRow
		var apprAt, revAt, ovrAt sql.NullTime
		var apprBy, revBy, ovrBy sql.NullInt64
		var revReason, ovrReason sql.NullString
		if err := rows.Scan(&r.MatchID, &r.TeamID, &apprAt, &apprBy, &revAt, &revBy, &revReason, &ovrAt, &ovrBy, &ovrReason); err != nil {
			return nil, err
		}
		if apprAt.Valid {
			t := apprAt.Time.UTC()
			r.ApprovedAt = &t
		}
		if apprBy.Valid {
			v := apprBy.Int64
			r.ApprovedBy = &v
		}
		if revAt.Valid {
			t := revAt.Time.UTC()
			r.RevokedAt = &t
		}
		if revBy.Valid {
			v := revBy.Int64
			r.RevokedBy = &v
		}
		if revReason.Valid {
			s := revReason.String
			r.RevokeReason = &s
		}
		if ovrAt.Valid {
			t := ovrAt.Time.UTC()
			r.OverrideApprovedAt = &t
		}
		if ovrBy.Valid {
			v := ovrBy.Int64
			r.OverrideApprovedBy = &v
		}
		if ovrReason.Valid {
			s := ovrReason.String
			r.OverrideReason = &s
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) EnsureMatchApprovals(ctx context.Context, matchID, teamAID, teamBID int64) error {
	const q = `
		INSERT INTO match_approval (match_id, team_id) VALUES ($1,$2)
		ON CONFLICT (match_id, team_id) DO NOTHING
	`
	if _, err := s.DB.Exec(ctx, q, matchID, teamAID); err != nil {
		return err
	}
	if _, err := s.DB.Exec(ctx, q, matchID, teamBID); err != nil {
		return err
	}
	return nil
}

func (s *Store) ApproveMatchTeam(ctx context.Context, matchID, teamID, captainID int64) error {
	const q = `
		UPDATE match_approval
		SET approved_at=now(), approved_by=$3,
		    revoked_at=NULL, revoked_by=NULL, revoke_reason=NULL,
		    override_approved_at=NULL, override_approved_by=NULL, override_reason=NULL
		WHERE match_id=$1 AND team_id=$2
	`
	tag, err := s.DB.Exec(ctx, q, matchID, teamID, captainID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) RevokeMatchApproval(ctx context.Context, matchID, teamID int64, by int64, reason string) error {
	const q = `
		UPDATE match_approval
		SET revoked_at=now(), revoked_by=$3, revoke_reason=$4,
		    approved_at=NULL, approved_by=NULL
		WHERE match_id=$1 AND team_id=$2 AND override_approved_at IS NULL
	`
	tag, err := s.DB.Exec(ctx, q, matchID, teamID, by, reason)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) OverrideMatchApproval(ctx context.Context, matchID, teamID int64, presidentID int64, reason string) error {
	const q = `
		UPDATE match_approval
		SET override_approved_at=now(), override_approved_by=$3, override_reason=$4,
		    revoked_at=NULL, revoked_by=NULL, revoke_reason=NULL,
		    approved_at=NULL, approved_by=NULL
		WHERE match_id=$1 AND team_id=$2
	`
	tag, err := s.DB.Exec(ctx, q, matchID, teamID, presidentID, reason)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// MatchApprovalEffective returns whether each side is satisfied (captain approval without revocation, or president override).
func (s *Store) MatchApprovalsEffective(ctx context.Context, matchID int64, teamAID, teamBID int64) (aOK bool, bOK bool, err error) {
	const q = `
		SELECT team_id,
		       (override_approved_at IS NOT NULL)
		       OR (approved_at IS NOT NULL AND revoked_at IS NULL)
		FROM match_approval WHERE match_id=$1 AND team_id IN ($2,$3)
	`
	rows, err := s.DB.Query(ctx, q, matchID, teamAID, teamBID)
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

func (s *Store) DeleteMatchResultsForEvent(ctx context.Context, eventID int64) error {
	const q = `
		DELETE FROM match_result mr USING match m
		WHERE mr.match_id = m.match_id AND m.event_id=$1
	`
	_, err := s.DB.Exec(ctx, q, eventID)
	return err
}

func (s *Store) InsertMatchResult(ctx context.Context, matchID int64, version int, computedBy int64, ptsA, ptsB int, scratchA, scratchB, hdcpA, hdcpB *int) error {
	const q = `
		INSERT INTO match_result (
			match_id, version, computed_by, team_a_points, team_b_points,
			team_a_total_scratch, team_b_total_scratch, team_a_total_hdcp, team_b_total_hdcp
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
	`
	_, err := s.DB.Exec(ctx, q, matchID, version, computedBy, ptsA, ptsB, scratchA, scratchB, hdcpA, hdcpB)
	return err
}

func (s *Store) recomputeSeasonTeamPointsTx(ctx context.Context, tx pgx.Tx, seasonID int64) error {
	if _, err := tx.Exec(ctx, `UPDATE season_team SET season_points=0 WHERE season_id=$1`, seasonID); err != nil {
		return err
	}

	const sumQ = `
		WITH fe AS (
			SELECT event_id FROM event WHERE season_id=$1 AND finalized=true
		),
		mm AS (
			SELECT m.match_id, m.team_a_id, m.team_b_id
			FROM match m
			WHERE m.event_id IN (SELECT event_id FROM fe)
		),
		latest AS (
			SELECT DISTINCT ON (mr.match_id)
				mr.match_id, mr.team_a_points, mr.team_b_points
			FROM match_result mr
			WHERE mr.match_id IN (SELECT match_id FROM mm)
			ORDER BY mr.match_id, mr.version DESC
		),
		pts AS (
			SELECT m.team_a_id AS tid, l.team_a_points AS pts FROM latest l JOIN mm m ON m.match_id=l.match_id
			UNION ALL
			SELECT m.team_b_id AS tid, l.team_b_points AS pts FROM latest l JOIN mm m ON m.match_id=l.match_id
		),
		agg AS (
			SELECT tid, SUM(pts)::int AS total FROM pts GROUP BY tid
		)
		UPDATE season_team st
		SET season_points = agg.total
		FROM agg
		WHERE st.season_id=$1 AND st.team_id = agg.tid
	`
	if _, err := tx.Exec(ctx, sumQ, seasonID); err != nil {
		return err
	}
	return nil
}

func (s *Store) RecomputeSeasonTeamPoints(ctx context.Context, seasonID int64) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := s.recomputeSeasonTeamPointsTx(ctx, tx, seasonID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *Store) GetSeasonIDForMatch(ctx context.Context, matchID int64) (int64, error) {
	const q = `
		SELECT e.season_id FROM match m JOIN event e ON e.event_id=m.event_id WHERE m.match_id=$1
	`
	var sid int64
	err := s.DB.QueryRow(ctx, q, matchID).Scan(&sid)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrNotFound
		}
		return 0, err
	}
	return sid, nil
}

func (s *Store) PlayerAffiliatedWithTeam(ctx context.Context, seasonID, playerID, teamID int64) (bool, error) {
	const q = `
		SELECT EXISTS (
			SELECT 1 FROM player_team_affiliation
			WHERE season_id=$1 AND player_id=$2 AND team_id=$3
		)
	`
	var ok bool
	err := s.DB.QueryRow(ctx, q, seasonID, playerID, teamID).Scan(&ok)
	return ok, err
}

func (s *Store) PlayerIsCaptainOfTeam(ctx context.Context, seasonID, playerID, teamID int64) (bool, error) {
	const q = `
		SELECT EXISTS (
			SELECT 1 FROM player_team_affiliation
			WHERE season_id=$1 AND player_id=$2 AND team_id=$3 AND is_captain=true
		)
	`
	var ok bool
	err := s.DB.QueryRow(ctx, q, seasonID, playerID, teamID).Scan(&ok)
	return ok, err
}

func (s *Store) ListMatchIDsForEvent(ctx context.Context, eventID int64) ([]int64, error) {
	const q = `SELECT match_id FROM match WHERE event_id=$1`
	rows, err := s.DB.Query(ctx, q, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
