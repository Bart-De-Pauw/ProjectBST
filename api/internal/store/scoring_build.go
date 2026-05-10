package store

import (
	"fmt"

	"projectbst/api/internal/scoring"
)

// BuildMatchScoresFromRows maps roster + score rows into scoring.MatchScores (complete).
func BuildMatchScoresFromRows(teamAID, teamBID int64, roster []RosterRow, rows []MatchPlayerGameRow) (scoring.MatchScores, error) {
	var ms scoring.MatchScores

	slotPlayer := map[int64]map[int16]int64{}
	for _, r := range roster {
		if r.TeamID != teamAID && r.TeamID != teamBID {
			continue
		}
		if slotPlayer[r.TeamID] == nil {
			slotPlayer[r.TeamID] = map[int16]int64{}
		}
		slotPlayer[r.TeamID][r.SlotPosition] = r.PlayerID
	}
	for _, tid := range []int64{teamAID, teamBID} {
		if len(slotPlayer[tid]) != 3 {
			return ms, scoring.ErrIncompleteScores
		}
		for s := int16(1); s <= 3; s++ {
			if slotPlayer[tid][s] == 0 {
				return ms, scoring.ErrIncompleteScores
			}
		}
	}

	hdcpByPlayer := map[int64]int16{}
	for _, rw := range rows {
		if rw.TeamID != teamAID && rw.TeamID != teamBID {
			continue
		}
		if h, ok := hdcpByPlayer[rw.PlayerID]; ok && h != rw.HdcpAtEvent {
			return ms, fmt.Errorf("hdcp must be identical for player %d across games", rw.PlayerID)
		}
		hdcpByPlayer[rw.PlayerID] = rw.HdcpAtEvent
	}

	find := func(teamID int64, slot int16, game int16) (MatchPlayerGameRow, bool) {
		pid := slotPlayer[teamID][slot]
		for _, rw := range rows {
			if rw.TeamID == teamID && rw.PlayerID == pid && rw.GameNumber == game && rw.SlotPosition == slot {
				return rw, true
			}
		}
		return MatchPlayerGameRow{}, false
	}

	fillSide := func(tid int64, side *scoring.TeamSide, gi int16) {
		for s := int16(1); s <= 3; s++ {
			rw, ok := find(tid, s, gi)
			if !ok {
				continue
			}
			(*side)[s-1] = scoring.Slot{Scratch: int(rw.ScratchScore), Hdcp: int(rw.HdcpAtEvent), Ok: true}
		}
	}

	for gi := int16(1); gi <= scoring.GamesPerEvening; gi++ {
		g := scoring.GameScores{}
		fillSide(teamAID, &g.A, gi)
		fillSide(teamBID, &g.B, gi)
		ms.Games[gi-1] = g
	}

	if err := scoring.ValidateComplete(ms); err != nil {
		return ms, err
	}
	return ms, nil
}

// BuildMatchScoresPartialFromRows fills whatever scores exist (live / provisional).
func BuildMatchScoresPartialFromRows(teamAID, teamBID int64, roster []RosterRow, rows []MatchPlayerGameRow) scoring.MatchScores {
	var ms scoring.MatchScores

	slotPlayer := map[int64]map[int16]int64{}
	for _, r := range roster {
		if r.TeamID != teamAID && r.TeamID != teamBID {
			continue
		}
		if slotPlayer[r.TeamID] == nil {
			slotPlayer[r.TeamID] = map[int16]int64{}
		}
		slotPlayer[r.TeamID][r.SlotPosition] = r.PlayerID
	}

	find := func(teamID int64, slot int16, game int16) (MatchPlayerGameRow, bool) {
		sm := slotPlayer[teamID]
		if sm == nil {
			return MatchPlayerGameRow{}, false
		}
		pid := sm[slot]
		if pid == 0 {
			return MatchPlayerGameRow{}, false
		}
		for _, rw := range rows {
			if rw.TeamID == teamID && rw.PlayerID == pid && rw.GameNumber == game && rw.SlotPosition == slot {
				return rw, true
			}
		}
		return MatchPlayerGameRow{}, false
	}

	fillSide := func(tid int64, side *scoring.TeamSide, gi int16) {
		for s := int16(1); s <= 3; s++ {
			rw, ok := find(tid, s, gi)
			if !ok {
				continue
			}
			(*side)[s-1] = scoring.Slot{Scratch: int(rw.ScratchScore), Hdcp: int(rw.HdcpAtEvent), Ok: true}
		}
	}

	for gi := int16(1); gi <= scoring.GamesPerEvening; gi++ {
		g := scoring.GameScores{}
		fillSide(teamAID, &g.A, gi)
		fillSide(teamBID, &g.B, gi)
		ms.Games[gi-1] = g
	}

	return ms
}
