package scoring

import "testing"

func TestScoreGame_allResolved(t *testing.T) {
	g := GameScores{
		A: TeamSide{
			{Scratch: 150, Hdcp: 10, Ok: true},
			{Scratch: 160, Hdcp: 10, Ok: true},
			{Scratch: 170, Hdcp: 10, Ok: true},
		},
		B: TeamSide{
			{Scratch: 140, Hdcp: 10, Ok: true},
			{Scratch: 180, Hdcp: 10, Ok: true},
			{Scratch: 165, Hdcp: 10, Ok: true},
		},
	}
	b := ScoreGame(g)
	if b.SlotsPending || b.TeamPending || b.BonusPending {
		t.Fatalf("unexpected pending: %+v", b)
	}
	// slots: A wins slot1 (160>150 vs 150?), compute: A slot1 160, B 150 -> A +1
	if b.SlotPtsA != 2 || b.SlotPtsB != 1 {
		t.Fatalf("slot pts got %+v", b)
	}
	// Team total uses sum(scratch)+sum(hdcp): B edges A → single team point for B.
	if b.TeamPtsA != 0 || b.TeamPtsB != 1 {
		t.Fatalf("team pts got %+v", b)
	}
	// Pre-bonus totals tied → no game bonus.
	if b.BonusA != 0 || b.BonusB != 0 {
		t.Fatalf("bonus got %+v", b)
	}
	if b.BonusPending {
		t.Fatalf("unexpected bonus pending: %+v", b)
	}
}

func TestScoreGame_pendingSlots(t *testing.T) {
	g := GameScores{
		A: TeamSide{{Scratch: 100, Hdcp: 0, Ok: true}, {}, {}},
		B: TeamSide{{Scratch: 90, Hdcp: 0, Ok: true}, {}, {}},
	}
	b := ScoreGame(g)
	if !b.SlotsPending || !b.TeamPending || !b.BonusPending {
		t.Fatalf("expected pending: %+v", b)
	}
	if b.SlotPtsA != 1 || b.SlotPtsB != 0 {
		t.Fatalf("slot1 should award if both ok: %+v", b)
	}
}

func TestScoreMatch_eveningBonus(t *testing.T) {
	ms := MatchScores{}
	for i := range ms.Games {
		ms.Games[i] = GameScores{
			A: TeamSide{{Ok: true}, {Ok: true}, {Ok: true}},
			B: TeamSide{{Ok: true}, {Ok: true}, {Ok: true}},
		}
		for s := 0; s < 3; s++ {
			ms.Games[i].A[s] = Slot{Scratch: 200, Hdcp: 0, Ok: true}
			ms.Games[i].B[s] = Slot{Scratch: 190, Hdcp: 0, Ok: true}
		}
	}
	tot := ScoreMatch(ms)
	if tot.EveningPending {
		t.Fatalf("expected evening resolved: %+v", tot)
	}
	if tot.EveningBonusA != 1 || tot.EveningBonusB != 0 {
		t.Fatalf("expected evening bonus to leader A: %+v", tot)
	}
}
