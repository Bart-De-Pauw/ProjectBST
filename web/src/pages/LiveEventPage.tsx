import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, jsonArray } from "../api/client";

type RosterRow = { teamId: number; playerId: number; slotPosition: number };
type ScoreRow = {
  teamId: number;
  playerId: number;
  slotPosition: number;
  gameNumber: number;
  scratchScore: number;
  hdcpAtEvent: number;
};

type GameBreakdown = {
  slotsPending: boolean;
  teamPending: boolean;
  bonusPending: boolean;
  slotPtsA: number;
  slotPtsB: number;
  teamPtsA: number;
  teamPtsB: number;
};

type LiveMatchBlock = {
  match: {
    matchId: number;
    laneNumber: string;
    teamAId: number;
    teamBId: number;
  };
  teamAName: string;
  teamBName: string;
  totals: {
    subtotalA: number;
    subtotalB: number;
    eveningBonusA: number;
    eveningBonusB: number;
    eveningPending: boolean;
    gameBreakdowns: GameBreakdown[];
  };
  roster: RosterRow[];
  scores: ScoreRow[];
};

type LivePayload = {
  eventId: number;
  seasonId: number;
  finalized: boolean;
  provisional: boolean;
  eventDate: string;
  matches: LiveMatchBlock[];
};

function normalizeMatches(raw: unknown): LiveMatchBlock[] {
  return jsonArray<LiveMatchBlock>(raw).map((block) => {
    const m = block.match;
    return {
      ...block,
      teamAName: block.teamAName || `Team #${m.teamAId}`,
      teamBName: block.teamBName || `Team #${m.teamBId}`,
      roster: jsonArray(block.roster as unknown) as RosterRow[],
      scores: jsonArray(block.scores as unknown) as ScoreRow[],
      totals: {
        ...block.totals,
        gameBreakdowns: jsonArray(block.totals?.gameBreakdowns as unknown) as GameBreakdown[],
      },
    };
  });
}

function rosterAssigned(roster: RosterRow[], teamId: number, slot: number): boolean {
  return roster.some((r) => r.teamId === teamId && r.slotPosition === slot);
}

function scoreEntered(scores: ScoreRow[], teamId: number, slot: number, game: number): boolean {
  return scores.some((s) => s.teamId === teamId && s.slotPosition === slot && s.gameNumber === game);
}

function gamesWithScores(scores: ScoreRow[]): number {
  const g = new Set<number>();
  for (const s of scores) {
    if (s.gameNumber >= 1 && s.gameNumber <= 3) g.add(s.gameNumber);
  }
  return g.size;
}

function pendingLabel(ok: boolean, pendingLabel: string): React.ReactNode {
  return (
    <Chip size="small" label={ok ? "ok" : pendingLabel} color={ok ? "success" : "warning"} variant={ok ? "filled" : "outlined"} />
  );
}

export function LiveEventPage() {
  const { eventId: eidParam } = useParams<{ eventId: string }>();
  const eventId = Number(eidParam);
  const validId = Number.isFinite(eventId) && eventId > 0;

  const [live, setLive] = useState<LivePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshIx, setRefreshIx] = useState(0);

  const load = useCallback(async () => {
    if (!validId) return;
    const res = await apiFetch(`/public/events/${eventId}/live`);
    if (!res.ok) {
      setErr("Could not load live event.");
      setLive(null);
      return;
    }
    const json = (await res.json()) as LivePayload & { matches?: unknown };
    setLive({
      ...json,
      matches: normalizeMatches(json.matches),
    });
    setErr(null);
    setRefreshIx((x) => x + 1);
  }, [eventId, validId]);

  useEffect(() => {
    void load();
  }, [load]);

  const gamesEnteredSummary = useMemo(() => {
    if (!live) return null;
    let maxGames = 0;
    for (const m of live.matches) {
      maxGames = Math.max(maxGames, gamesWithScores(m.scores));
    }
    return maxGames;
  }, [live]);

  if (!validId) {
    return (
      <Alert sx={{ m: 2 }}>
        Invalid event id. <Link to="/">Home</Link>
      </Alert>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h5">Live event #{eventId}</Typography>
      {live ? (
        <Typography variant="body2" color="text.secondary">
          {String(live.eventDate).slice(0, 10)}
          {" · "}
          <Link to={`/seasons/${live.seasonId}/leaderboards`}>Season leaderboards</Link>
        </Typography>
      ) : null}

      {!live?.finalized ? (
        <Alert severity="info">
          Live / Unfinalized — standings and points may change until the president finalizes this event.
        </Alert>
      ) : (
        <Alert severity="success">This event is finalized. Scores shown are from the completed evening.</Alert>
      )}

      {gamesEnteredSummary != null && live && live.matches.length > 0 ? (
        <Typography variant="body2">
          Furthest progress: Game {gamesEnteredSummary}/3 entered (across matches).
        </Typography>
      ) : null}

      <Stack direction="row" spacing={1}>
        <Button variant="outlined" size="small" onClick={() => void load()}>
          Refresh
        </Button>
      </Stack>

      {err ? <Alert severity="error">{err}</Alert> : null}

      {!live ? (
        <Typography>Loading live data…</Typography>
      ) : live.matches.length === 0 ? (
        <Alert severity="info">No matches scheduled for this event yet.</Alert>
      ) : (
        live.matches.map((block) => (
          <MatchLiveCard key={block.match.matchId} block={block} refreshIx={refreshIx} />
        ))
      )}

      <Typography variant="body2">
        <Link to="/">Home</Link>
      </Typography>
    </Stack>
  );
}

function MatchLiveCard({ block, refreshIx }: { block: LiveMatchBlock; refreshIx: number }) {
  const { match: m, totals: t } = block;
  const gamesEntered = gamesWithScores(block.scores);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" flexWrap="wrap" spacing={2} alignItems="center">
          <Typography variant="h6">Lane {m.laneNumber}</Typography>
          <Typography variant="body1">
            {block.teamAName} vs {block.teamBName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Game {gamesEntered}/3 entered · Points {t.subtotalA}+{t.eveningBonusA} – {t.subtotalB}+{t.eveningBonusB}
            {t.eveningPending ? " (evening bonus pending)" : ""}
          </Typography>
        </Stack>

        <Typography variant="subtitle2">Game status</Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {t.gameBreakdowns.map((g, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5, minWidth: 200 }}>
              <Typography variant="caption" fontWeight={600}>
                Game {i + 1}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                {pendingLabel(!g.slotsPending, "slots pending")}
                {pendingLabel(!g.teamPending, "team pending")}
                {pendingLabel(!g.bonusPending, "bonus pending")}
              </Stack>
              {!g.slotsPending && !g.teamPending && !g.bonusPending ? (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }} color="text.secondary">
                  Points: A {g.slotPtsA + g.teamPtsA + g.bonusA} – B {g.slotPtsB + g.teamPtsB + g.bonusB}
                </Typography>
              ) : null}
            </Paper>
          ))}
        </Stack>

        <Typography variant="subtitle2">Score completeness</Typography>
        <Typography variant="caption" color="text.secondary">
          Green = score entered. Yellow = player assigned but score missing. Gray = no player in slot.
        </Typography>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Team</TableCell>
                <TableCell>Slot</TableCell>
                <TableCell>G1</TableCell>
                <TableCell>G2</TableCell>
                <TableCell>G3</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[m.teamAId, m.teamBId].flatMap((teamId) => {
                const label = teamId === m.teamAId ? block.teamAName : block.teamBName;
                return ([1, 2, 3] as const).map((slot) => (
                  <TableRow key={`${teamId}-${slot}`}>
                    <TableCell>{label}</TableCell>
                    <TableCell>{slot}</TableCell>
                    {([1, 2, 3] as const).map((game) => {
                      const assigned = rosterAssigned(block.roster, teamId, slot);
                      const entered = scoreEntered(block.scores, teamId, slot, game);
                      const score = block.scores.find(
                        (s) => s.teamId === teamId && s.slotPosition === slot && s.gameNumber === game,
                      );
                      let color: "default" | "success" | "warning" = "default";
                      let text = "—";
                      if (!assigned) {
                        text = "empty";
                      } else if (entered && score) {
                        color = "success";
                        text = String(score.scratchScore);
                      } else {
                        color = "warning";
                        text = "missing";
                      }
                      return (
                        <TableCell key={game}>
                          <Chip size="small" label={text} color={color} variant="outlined" />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
        </Box>
      </Stack>
    </Paper>
  );
}
