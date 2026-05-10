package scoring

import "errors"

// ErrIncompleteScores indicates missing score cells required for a finalized match.
var ErrIncompleteScores = errors.New("incomplete scores for match")

// Slot holds scratch pins and handicap for one player-slot in one game.
type Slot struct {
	Scratch int
	Hdcp    int
	Ok      bool
}

const GamesPerEvening = 3

// TeamSide is three slots for one team in one game.
type TeamSide [3]Slot

// GameScores contains both teams for one game (1..3).
type GameScores struct {
	A TeamSide
	B TeamSide
}

// GameBreakdown is awarded points for a single game (including game bonus when resolved).
type GameBreakdown struct {
	SlotPtsA int `json:"slotPtsA"`
	SlotPtsB int `json:"slotPtsB"`
	TeamPtsA int `json:"teamPtsA"` // 0 or 1
	TeamPtsB int `json:"teamPtsB"` // 0 or 1
	BonusA   int `json:"bonusA"`   // 0 or 1
	BonusB   int `json:"bonusB"`   // 0 or 1

	SlotsPending bool `json:"slotsPending"`
	TeamPending  bool `json:"teamPending"`
	BonusPending bool `json:"bonusPending"`
}

func scratchHdcp(s Slot) int {
	return s.Scratch + s.Hdcp
}

// ScoreGame awards slot points only when both slots have data; team total when all six slots have data;
// bonus only when slot comparisons and team comparison are fully resolved for this game.
func ScoreGame(g GameScores) GameBreakdown {
	out := GameBreakdown{}

	slotPairsResolved := true
	for i := 0; i < 3; i++ {
		a, b := g.A[i], g.B[i]
		if !a.Ok || !b.Ok {
			out.SlotsPending = true
			slotPairsResolved = false
			continue
		}
		sa, sb := scratchHdcp(a), scratchHdcp(b)
		if sa > sb {
			out.SlotPtsA++
		} else if sb > sa {
			out.SlotPtsB++
		}
	}

	allSix := true
	for i := 0; i < 3; i++ {
		if !g.A[i].Ok || !g.B[i].Ok {
			allSix = false
			break
		}
	}
	if !allSix {
		out.TeamPending = true
	} else {
		sumA, sumB := 0, 0
		for i := 0; i < 3; i++ {
			sumA += scratchHdcp(g.A[i])
			sumB += scratchHdcp(g.B[i])
		}
		if sumA > sumB {
			out.TeamPtsA = 1
		} else if sumB > sumA {
			out.TeamPtsB = 1
		}
	}

	bonusResolvable := slotPairsResolved && !out.TeamPending
	if bonusResolvable {
		preA := out.SlotPtsA + out.TeamPtsA
		preB := out.SlotPtsB + out.TeamPtsB
		if preA > preB {
			out.BonusA = 1
		} else if preB > preA {
			out.BonusB = 1
		}
	} else {
		out.BonusPending = true
	}

	return out
}

// MatchScores is three games for one head-to-head match.
type MatchScores struct {
	Games [GamesPerEvening]GameScores
}

// MatchTotals sums awarded points across games and awards end-of-evening bonus (+1) when all games are fully resolved.
type MatchTotals struct {
	GameBreakdowns [GamesPerEvening]GameBreakdown `json:"gameBreakdowns"`
	SubtotalA      int                            `json:"subtotalA"`
	SubtotalB      int                            `json:"subtotalB"`
	EveningBonusA  int                            `json:"eveningBonusA"` // 0 or 1
	EveningBonusB  int                            `json:"eveningBonusB"` // 0 or 1
	EveningPending bool                           `json:"eveningPending"`
}

func (m MatchTotals) TeamAPoints() int {
	return m.SubtotalA + m.EveningBonusA
}

func (m MatchTotals) TeamBPoints() int {
	return m.SubtotalB + m.EveningBonusB
}

// ScoreMatch computes match evening points from entered games.
func ScoreMatch(ms MatchScores) MatchTotals {
	out := MatchTotals{}
	allGamesResolved := true
	for gi := 0; gi < GamesPerEvening; gi++ {
		b := ScoreGame(ms.Games[gi])
		out.GameBreakdowns[gi] = b
		if b.SlotsPending || b.TeamPending || b.BonusPending {
			allGamesResolved = false
		}
		out.SubtotalA += b.SlotPtsA + b.TeamPtsA + b.BonusA
		out.SubtotalB += b.SlotPtsB + b.TeamPtsB + b.BonusB
	}

	if !allGamesResolved {
		out.EveningPending = true
		return out
	}

	if out.SubtotalA > out.SubtotalB {
		out.EveningBonusA = 1
	} else if out.SubtotalB > out.SubtotalA {
		out.EveningBonusB = 1
	}
	return out
}

// ValidateComplete returns an error if any slot in any game is missing score data.
func ValidateComplete(ms MatchScores) error {
	for _, g := range ms.Games {
		for i := 0; i < 3; i++ {
			if !g.A[i].Ok || !g.B[i].Ok {
				return ErrIncompleteScores
			}
		}
	}
	return nil
}
