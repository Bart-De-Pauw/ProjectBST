import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiErrorText, apiFetch, apiUrl, jsonArray } from "../api/client";
import type { Role } from "../auth/AuthContext";
import { useAuth } from "../auth/AuthContext";

type MatchDTO = {
  matchId: number;
  eventId: number;
  laneNumber: string;
  teamAId: number;
  teamBId: number;
};

type LiveMatchBlock = {
  match: MatchDTO;
  totals: {
    subtotalA: number;
    subtotalB: number;
    eveningBonusA: number;
    eveningBonusB: number;
    eveningPending: boolean;
    gameBreakdowns: Array<{ slotsPending: boolean; teamPending: boolean; bonusPending: boolean }>;
  };
  roster: Array<{ teamId: number; playerId: number; slotPosition: number }>;
  scores: Array<{
    teamId: number;
    playerId: number;
    slotPosition: number;
    gameNumber: number;
    scratchScore: number;
    hdcpAtEvent: number;
  }>;
};

type LivePayload = {
  eventId: number;
  seasonId: number;
  finalized: boolean;
  eventDate: string;
  provisional: boolean;
  matches: LiveMatchBlock[];
};

type TeamRef = { teamId: number; teamName: string };
type PlayerRow = { playerId: number; fullName: string; username: string };
type AffiliationRow = { playerId: number; teamId: number; isCaptain: boolean };
type SeasonTeamRow = { teamId: number };
type ApprovalRow = {
  teamId: number;
  approvedAt?: string;
  revokedAt?: string;
  overrideApprovedAt?: string;
  overrideReason?: string | null;
};

/** Go JSON encodes empty slices as `null`; roster/scores must be arrays for the UI. */
function normalizeLiveMatchBlocks(blocks: LiveMatchBlock[]): LiveMatchBlock[] {
  return blocks.map((block) => ({
    ...block,
    roster: jsonArray(block.roster as unknown) as LiveMatchBlock["roster"],
    scores: jsonArray(block.scores as unknown) as LiveMatchBlock["scores"],
  }));
}

function usedTeamIDsForEvent(matches: LiveMatchBlock[]): Set<number> {
  const s = new Set<number>();
  for (const m of matches) {
    s.add(m.match.teamAId);
    s.add(m.match.teamBId);
  }
  return s;
}

function editableTeamIdsForMatch(
  isPresident: boolean,
  captainTeamIds: Set<number>,
  teamAId: number,
  teamBId: number,
): Set<number> {
  const s = new Set<number>();
  if (isPresident) {
    s.add(teamAId);
    s.add(teamBId);
  } else {
    if (captainTeamIds.has(teamAId)) s.add(teamAId);
    if (captainTeamIds.has(teamBId)) s.add(teamBId);
  }
  return s;
}

export function EventAdminPage() {
  const auth = useAuth();
  const { eventId: eidParam } = useParams<{ eventId: string }>();
  const eventId = Number(eidParam);
  const validId = Number.isFinite(eventId) && eventId > 0;

  const [live, setLive] = useState<LivePayload | null>(null);
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [affiliations, setAffiliations] = useState<AffiliationRow[]>([]);
  const [seasonTeams, setSeasonTeams] = useState<SeasonTeamRow[]>([]);
  const [approvals, setApprovals] = useState<Record<number, ApprovalRow[]>>({});
  const [reloadIx, setReloadIx] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [digestMsg, setDigestMsg] = useState<string | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const reloadAll = useCallback(async () => {
    if (!validId) return;
    const liveRes = await apiFetch(`/public/events/${eventId}/live`);
    if (!liveRes.ok) {
      setErr("Could not load event.");
      return;
    }
    const liveJson = (await liveRes.json()) as LivePayload;
    const matches = normalizeLiveMatchBlocks(jsonArray<LiveMatchBlock>((liveJson as { matches?: unknown }).matches));
    setLive({ ...liveJson, matches });
    const sid = liveJson.seasonId;
    const [tRes, pRes, aRes, stRes] = await Promise.all([
      apiFetch("/teams"),
      apiFetch("/players"),
      apiFetch(`/seasons/${sid}/affiliations`),
      apiFetch(`/seasons/${sid}/teams`),
    ]);
    if (!tRes.ok || !pRes.ok || !aRes.ok || !stRes.ok) {
      setErr("Could not load lookup data.");
      return;
    }
    setTeams(jsonArray<TeamRef>(await tRes.json()));
    setPlayers(jsonArray<PlayerRow>(await pRes.json()));
    setAffiliations(jsonArray<AffiliationRow>(await aRes.json()));
    setSeasonTeams(jsonArray<SeasonTeamRow>(await stRes.json()));
    setErr(null);

    const apprMap: Record<number, ApprovalRow[]> = {};
    const role = auth.status === "authenticated" ? auth.me.role : null;
    if (role === "President") {
      await Promise.all(
        matches.map(async (b) => {
          const ar = await apiFetch(`/matches/${b.match.matchId}/approvals`);
          if (ar.ok) apprMap[b.match.matchId] = jsonArray<ApprovalRow>(await ar.json());
        }),
      );
    }
    setApprovals(apprMap);
    setReloadIx((x) => x + 1);
  }, [auth, eventId, validId]);

  useEffect(() => {
    if (auth.status === "authenticated" && validId) void reloadAll();
  }, [auth, reloadAll, validId]);

  const teamName = useCallback(
    (id: number) => teams.find((t) => t.teamId === id)?.teamName ?? `#${id}`,
    [teams],
  );

  const playersForTeam = useCallback(
    (teamId: number): PlayerRow[] => {
      const ids = new Set(affiliations.filter((a) => a.teamId === teamId).map((a) => a.playerId));
      return players.filter((p) => ids.has(p.playerId));
    },
    [affiliations, players],
  );

  const isPresident = auth.status === "authenticated" && auth.me.role === "President";
  const captainTeamIds = useMemo(() => {
    if (auth.status !== "authenticated") return new Set<number>();
    return new Set(
      affiliations.filter((a) => a.playerId === auth.me.playerId && a.isCaptain).map((a) => a.teamId),
    );
  }, [affiliations, auth]);

  const visibleMatches = useMemo(() => {
    if (!live) return [];
    if (isPresident) return live.matches;
    return live.matches.filter(
      (b) => captainTeamIds.has(b.match.teamAId) || captainTeamIds.has(b.match.teamBId),
    );
  }, [live, isPresident, captainTeamIds]);

  const usedTeams = useMemo(() => usedTeamIDsForEvent(live?.matches ?? []), [live?.matches]);
  const availableTeamCount = useMemo(
    () => seasonTeams.filter((st) => !usedTeams.has(st.teamId)).length,
    [seasonTeams, usedTeams],
  );

  async function finalizeEvent() {
    const res = await apiFetch(`/events/${eventId}/finalize`, { method: "POST" });
    if (!res.ok) {
      const t = await res.text();
      setErr(t || "Finalize failed.");
      return;
    }
    setErr(null);
    void reloadAll();
  }

  async function reopenEvent() {
    const res = await apiFetch(`/events/${eventId}/reopen`, {
      method: "POST",
      body: JSON.stringify({ reason: reopenReason.trim() || "reopen" }),
    });
    if (!res.ok) {
      const t = await res.text();
      setErr(t || "Reopen failed.");
      return;
    }
    setErr(null);
    setReopenOpen(false);
    setReopenReason("");
    void reloadAll();
  }

  async function sendDigestStub() {
    const res = await apiFetch(`/events/${eventId}/send-digest`, { method: "POST" });
    const json = res.ok ? await res.json() : null;
    setDigestMsg(JSON.stringify(json ?? (await res.text()), null, 2));
  }

  if (auth.status === "loading") return <Typography sx={{ p: 2 }}>Loading…</Typography>;
  if (auth.status !== "authenticated") {
    return (
      <Alert sx={{ m: 2 }}>
        Sign-in required. <Link to="/login">Sign in</Link>
      </Alert>
    );
  }
  const canAccessByRole = auth.me.role === "President" || auth.me.role === "Captain";
  const canAccessByAffiliation = captainTeamIds.size > 0;
  if (!canAccessByRole && !canAccessByAffiliation) {
    if (!live) return <Typography sx={{ p: 2 }}>Loading…</Typography>;
    return (
      <Alert sx={{ m: 2 }}>
        Only the President or a team captain (season affiliation) can manage match rosters on this screen.
      </Alert>
    );
  }
  if (!validId) {
    return (
      <Alert sx={{ m: 2 }}>
        Invalid event. <Link to="/admin/seasons">Seasons</Link>
      </Alert>
    );
  }

  const finalized = live?.finalized ?? false;
  const seasonId = live?.seasonId ?? 0;

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h5">
        {isPresident ? "Event" : "Match roster & scores"} #{eventId}
        {live ? ` · ${String(live.eventDate).slice(0, 10)}` : null}
      </Typography>
      <Typography variant="body2">
        {isPresident ? (
          <>
            <Link to={`/admin/seasons/${seasonId}`}>Back to season</Link>
            {" · "}
            <a href={apiUrl(`/public/events/${eventId}/live`)} target="_blank" rel="noreferrer">
              Public live JSON
            </a>
          </>
        ) : (
          <>Set roster slots 1–3 and enter scratch scores for your team.</>
        )}
      </Typography>
      {err ? <Alert severity="error">{err}</Alert> : null}
      {digestMsg ? (
        <Alert severity="info" onClose={() => setDigestMsg(null)}>
          <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
            {digestMsg}
          </Typography>
        </Alert>
      ) : null}

      {isPresident ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <Typography variant="body2">{finalized ? "Finalized" : "Open for edits"}</Typography>
          {!finalized ? (
            <Button variant="contained" color="success" onClick={() => void finalizeEvent()}>
              Finalize event
            </Button>
          ) : (
            <>
              <Button variant="outlined" color="warning" onClick={() => setReopenOpen(true)}>
                Reopen event
              </Button>
              <Button variant="outlined" onClick={() => void sendDigestStub()}>
                Send digest (stub)
              </Button>
            </>
          )}
          <Button variant="outlined" onClick={() => setMatchOpen(true)} disabled={finalized || availableTeamCount === 0}>
            Add match
          </Button>
        </Stack>
      ) : (
        <Typography variant="body2">
          {finalized ? "Event finalized — roster and scores locked." : "Open for roster and score edits."}
        </Typography>
      )}

      {!live ? (
        <Typography sx={{ p: 2 }}>Loading event…</Typography>
      ) : visibleMatches.length === 0 ? (
        <Alert severity="info">No matches on this event for teams you captain.</Alert>
      ) : (
        <>
          {isPresident ? (
            <>
          <Typography variant="h6">Evening schedule</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {live.matches.length === 0
              ? "No matches yet — add lane matchups below."
              : `${live.matches.length} match${live.matches.length === 1 ? "" : "es"} scheduled.`}
            {availableTeamCount === 0 && seasonTeams.length > 0 && !finalized ? " All enrolled teams are already on the schedule." : null}
          </Typography>
          <Table size="small" sx={{ mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>Lane</TableCell>
                <TableCell>Team A</TableCell>
                <TableCell />
                <TableCell>Team B</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {live.matches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary">
                      Use &quot;Add match&quot; to schedule teams for this evening.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                live.matches.map((block) => (
                  <TableRow key={block.match.matchId}>
                    <TableCell>{block.match.laneNumber}</TableCell>
                    <TableCell>{teamName(block.match.teamAId)}</TableCell>
                    <TableCell align="center">vs</TableCell>
                    <TableCell>{teamName(block.match.teamBId)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
            </>
          ) : null}

          <Typography variant="h6">{isPresident ? "Match details" : "Your matches"}</Typography>
          {visibleMatches.map((block, i) => {
            const matchEditableTeamIds = editableTeamIdsForMatch(
              isPresident,
              captainTeamIds,
              block.match.teamAId,
              block.match.teamBId,
            );
            return (
          <MatchAccordion
            key={block.match.matchId}
            defaultExpanded={i === 0}
            block={block}
            approvals={approvals[block.match.matchId] ?? []}
            reloadIx={reloadIx}
            teamName={teamName}
            playersForTeam={playersForTeam}
            disabled={finalized}
            userRole={auth.me.role}
            editableTeamIds={matchEditableTeamIds}
            canEditScores={isPresident || matchEditableTeamIds.size > 0}
            onReload={() => void reloadAll()}
            onError={setErr}
          />
            );
          })}
        </>
      )}

      {isPresident ? (
        <CreateMatchDialog
          open={matchOpen}
          onClose={() => setMatchOpen(false)}
          eventId={eventId}
          seasonTeams={seasonTeams}
          usedTeamIDs={usedTeams}
          teamName={teamName}
          disabled={finalized}
          onCreated={() => void reloadAll()}
          onError={setErr}
        />
      ) : null}

      {isPresident ? (
      <Dialog open={reopenOpen} onClose={() => setReopenOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Reopen event</DialogTitle>
        <DialogContent>
          <TextField label="Reason" fullWidth multiline minRows={2} sx={{ mt: 1 }} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReopenOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void reopenEvent()}>
            Reopen
          </Button>
        </DialogActions>
      </Dialog>
      ) : null}

      <Typography variant="body2">
        <Link to="/">Home</Link>
      </Typography>
    </Stack>
  );
}

function approvalEffective(row: ApprovalRow): boolean {
  if (row.overrideApprovedAt) return true;
  if (row.approvedAt && !row.revokedAt) return true;
  return false;
}

function MatchAccordion({
  defaultExpanded,
  block,
  approvals,
  reloadIx,
  teamName,
  playersForTeam,
  disabled,
  userRole,
  editableTeamIds,
  canEditScores,
  onReload,
  onError,
}: {
  defaultExpanded: boolean;
  block: LiveMatchBlock;
  approvals: ApprovalRow[];
  reloadIx: number;
  teamName: (id: number) => string;
  playersForTeam: (teamId: number) => PlayerRow[];
  disabled: boolean;
  userRole: Role;
  editableTeamIds: Set<number>;
  canEditScores: boolean;
  onReload: () => void;
  onError: (msg: string | null) => void;
}) {
  const { match: m, totals } = block;
  const [rosterPick, setRosterPick] = useState<Record<string, string>>({}); // key: `${teamId}-${slot}` => playerId
  const [hdcpPick, setHdcpPick] = useState<Record<string, string>>({}); // key: `${teamId}-${slot}` => hdcp
  const [scratchPick, setScratchPick] = useState<Record<string, string>>({}); // key: `${teamId}-${slot}-${game}` => scratch
  const [overrideOpen, setOverrideOpen] = useState<number | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  useEffect(() => {
    const rp: Record<string, string> = {};
    for (const row of jsonArray(block.roster as unknown)) {
      rp[`${row.teamId}-${row.slotPosition}`] = String(row.playerId);
    }
    setRosterPick(rp);
    const hp: Record<string, string> = {};
    const sp: Record<string, string> = {};
    for (const row of jsonArray(block.scores as unknown)) {
      const slotKey = `${row.teamId}-${row.slotPosition}`;
      // Prefer first-seen; assume hdcp stays constant across games.
      if (hp[slotKey] === undefined) hp[slotKey] = String(row.hdcpAtEvent);
      sp[`${row.teamId}-${row.slotPosition}-${row.gameNumber}`] = String(row.scratchScore);
    }
    setHdcpPick(hp);
    setScratchPick(sp);
  }, [block.match.matchId, reloadIx, block.roster, block.scores]);

  async function saveRoster() {
    onError(null);
    const rosterBody: Array<{ teamId: number; playerId: number; slotPosition: number }> = [];
    for (const tid of [m.teamAId, m.teamBId]) {
      if (!editableTeamIds.has(tid)) continue;
      for (const slot of [1, 2, 3] as const) {
        const pidStr = rosterPick[`${tid}-${slot}`];
        const pid = pidStr ? Number(pidStr) : 0;
        if (pid > 0) rosterBody.push({ teamId: tid, playerId: pid, slotPosition: slot });
      }
    }
    const rr = await apiFetch(`/matches/${m.matchId}/roster`, {
      method: "PUT",
      body: JSON.stringify(rosterBody),
    });
    if (!rr.ok) {
      onError(await apiErrorText(rr));
      return;
    }
    onReload();
  }

  async function saveRosterAndScores() {
    onError(null);
    const rosterBody: Array<{ teamId: number; playerId: number; slotPosition: number }> = [];
    for (const tid of [m.teamAId, m.teamBId]) {
      if (!editableTeamIds.has(tid)) continue;
      for (const slot of [1, 2, 3] as const) {
        const pidStr = rosterPick[`${tid}-${slot}`];
        const pid = pidStr ? Number(pidStr) : 0;
        if (pid > 0) rosterBody.push({ teamId: tid, playerId: pid, slotPosition: slot });
      }
    }
    const rr = await apiFetch(`/matches/${m.matchId}/roster`, {
      method: "PUT",
      body: JSON.stringify(rosterBody),
    });
    if (!rr.ok) {
      onError(await apiErrorText(rr));
      return;
    }

    // scores upsert (scratch only; hdcp comes from per-slot input and is applied to all games)
    for (const tid of [m.teamAId, m.teamBId]) {
      if (!editableTeamIds.has(tid)) continue;
      for (const slot of [1, 2, 3] as const) {
        const pidStr = rosterPick[`${tid}-${slot}`];
        const playerId = pidStr ? Number(pidStr) : 0;
        if (!playerId) continue;

        const hdRaw = hdcpPick[`${tid}-${slot}`];
        const hd = hdRaw != null && String(hdRaw).trim() !== "" ? Number(hdRaw) : 0;
        const hdcpAtEvent = Number.isFinite(hd) ? Math.min(300, Math.max(0, Math.round(hd))) : 0;

        for (const game of [1, 2, 3] as const) {
          const raw = scratchPick[`${tid}-${slot}-${game}`];
          if (!raw || String(raw).trim() === "") continue;
          const sc = Number(String(raw).trim());
          if (!Number.isFinite(sc)) continue;
          const scratchScore = Math.min(300, Math.max(0, Math.round(sc)));
          const res = await apiFetch(`/matches/${m.matchId}/scores`, {
            method: "POST",
            body: JSON.stringify({
              teamId: tid,
              playerId,
              slotPosition: slot,
              gameNumber: game,
              scratchScore,
              hdcpAtEvent,
            }),
          });
          if (!res.ok) {
            onError(await apiErrorText(res));
            return;
          }
        }
      }
    }
    onReload();
  }

  async function overrideApprove(teamId: number) {
    const res = await apiFetch(`/matches/${m.matchId}/approve/override`, {
      method: "POST",
      body: JSON.stringify({ teamId, reason: overrideReason.trim() || "president override" }),
    });
    if (!res.ok) return;
    setOverrideOpen(null);
    setOverrideReason("");
    onReload();
  }

  const apprByTeam = useMemo(() => {
    const map = new Map<number, ApprovalRow>();
    for (const a of approvals) map.set(a.teamId, a);
    return map;
  }, [approvals]);

  function availablePlayersForSlot(teamId: number, slotPosition: number): PlayerRow[] {
    const current = rosterPick[`${teamId}-${slotPosition}`];
    const used = new Set<number>();
    for (const s of [1, 2, 3] as const) {
      if (s === slotPosition) continue;
      const v = rosterPick[`${teamId}-${s}`];
      const n = v ? Number(v) : 0;
      if (Number.isFinite(n) && n > 0) used.add(n);
    }
    // Keep current selection visible even if it would otherwise be excluded.
    return playersForTeam(teamId).filter((p) => !used.has(p.playerId) || String(p.playerId) === current);
  }

  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters>
      <AccordionSummary expandIcon={<Typography sx={{ px: 1 }}>▾</Typography>}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography fontWeight={600}>Lane {m.laneNumber}</Typography>
          <Typography variant="body2">
            {teamName(m.teamAId)} vs {teamName(m.teamBId)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Points {totals.subtotalA}+{totals.eveningBonusA} – {totals.subtotalB}+{totals.eveningBonusB}
            {totals.eveningPending ? " · evening pending" : ""}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          {userRole === "President" ? (
            <>
              <Typography variant="subtitle2">Completeness</Typography>
              <Typography variant="caption" component="div">
                {(totals.gameBreakdowns ?? []).map((g, i) => (
                  <span key={i}>
                    G{i + 1}: slots {g.slotsPending ? "pending" : "ok"}, team {g.teamPending ? "pending" : "ok"}
                    {i < 2 ? " · " : ""}
                  </span>
                ))}
              </Typography>

              <Typography variant="subtitle2">Approvals</Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
            {[m.teamAId, m.teamBId].map((tid) => {
              const row = apprByTeam.get(tid);
              const ok = row ? approvalEffective(row) : false;
              return (
                <Typography key={tid} variant="body2">
                  {teamName(tid)}: {ok ? "OK" : "needed"}
                  {row?.overrideApprovedAt ? " (override)" : ""}
                  {row?.revokedAt && !row.overrideApprovedAt ? " (revoked)" : ""}
                  {userRole === "President" && !disabled ? (
                    <Button size="small" sx={{ ml: 1 }} onClick={() => setOverrideOpen(tid)}>
                      Override
                    </Button>
                  ) : null}
                </Typography>
              );
            })}
          </Stack>
            </>
          ) : null}

          <Typography variant="subtitle2">{canEditScores ? "Roster + scores" : "Roster (slots 1–3)"}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Team</TableCell>
                <TableCell>Slot#</TableCell>
                <TableCell sx={{ minWidth: 220 }}>Player</TableCell>
                {canEditScores ? (
                  <>
                    <TableCell>Hdcp</TableCell>
                    <TableCell>G1</TableCell>
                    <TableCell>G2</TableCell>
                    <TableCell>G3</TableCell>
                    <TableCell>G1+hdcp</TableCell>
                    <TableCell>G2+hdcp</TableCell>
                    <TableCell>G3+hdcp</TableCell>
                    <TableCell>Total</TableCell>
                  </>
                ) : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {[m.teamAId, m.teamBId].flatMap((tid) =>
                ([1, 2, 3] as const).map((slot) => {
                  const canEditTeam = editableTeamIds.has(tid);
                  const pid = rosterPick[`${tid}-${slot}`] ?? "";
                  const hdStr = hdcpPick[`${tid}-${slot}`] ?? "";
                  const hd = Number(String(hdStr).trim());
                  const hdcp = Number.isFinite(hd) ? Math.min(300, Math.max(0, Math.round(hd))) : 0;
                  const g1 = numOrNull(scratchPick[`${tid}-${slot}-1`]);
                  const g2 = numOrNull(scratchPick[`${tid}-${slot}-2`]);
                  const g3 = numOrNull(scratchPick[`${tid}-${slot}-3`]);
                  const g1h = g1 == null ? null : g1 + hdcp;
                  const g2h = g2 == null ? null : g2 + hdcp;
                  const g3h = g3 == null ? null : g3 + hdcp;
                  const total = (g1h ?? 0) + (g2h ?? 0) + (g3h ?? 0);
                  const showTotal = g1 == null && g2 == null && g3 == null ? "—" : String(total);
                  const playerName =
                    pid && playersForTeam(tid).find((p) => String(p.playerId) === pid)?.fullName;

                  return (
                    <TableRow key={`rs-${tid}-${slot}`}>
                      <TableCell>{teamName(tid)}</TableCell>
                      <TableCell>{slot}</TableCell>
                      <TableCell>
                        {canEditTeam ? (
                          <TextField
                            select
                            fullWidth
                            size="small"
                            disabled={disabled}
                            value={pid}
                            onChange={(e) =>
                              setRosterPick((prev) => ({ ...prev, [`${tid}-${slot}`]: e.target.value }))
                            }
                          >
                            <MenuItem value="">
                              <em>—</em>
                            </MenuItem>
                            {availablePlayersForSlot(tid, slot).map((p) => (
                              <MenuItem key={p.playerId} value={String(p.playerId)}>
                                {p.fullName}
                              </MenuItem>
                            ))}
                          </TextField>
                        ) : (
                          <Typography variant="body2">{playerName ?? "—"}</Typography>
                        )}
                      </TableCell>
                      {canEditScores ? (
                        <>
                          <TableCell>
                            <TextField
                              size="small"
                              disabled={disabled || !canEditTeam}
                              value={hdStr}
                              onChange={(e) =>
                                setHdcpPick((prev) => ({ ...prev, [`${tid}-${slot}`]: e.target.value }))
                              }
                              sx={{ width: 80 }}
                            />
                          </TableCell>
                          {([1, 2, 3] as const).map((game) => (
                            <TableCell key={game}>
                              <TextField
                                size="small"
                                disabled={disabled || !canEditTeam}
                                value={scratchPick[`${tid}-${slot}-${game}`] ?? ""}
                                onChange={(e) =>
                                  setScratchPick((prev) => ({
                                    ...prev,
                                    [`${tid}-${slot}-${game}`]: e.target.value,
                                  }))
                                }
                                sx={{ width: 70 }}
                              />
                            </TableCell>
                          ))}
                          <TableCell>{g1h == null ? "—" : g1h}</TableCell>
                          <TableCell>{g2h == null ? "—" : g2h}</TableCell>
                          <TableCell>{g3h == null ? "—" : g3h}</TableCell>
                          <TableCell>{showTotal}</TableCell>
                        </>
                      ) : null}
                    </TableRow>
                  );
                }),
              )}
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary">
            {canEditScores
              ? userRole === "President"
                ? "Enter scratch only for G1–G3. Hdcp is applied to each game for totals and is saved with each submitted score."
                : "Enter roster and scratch scores for your team (G1–G3). Hdcp applies to all three games. Opponent rows are read-only."
              : "Choose one player per slot for your team. Opponent roster is shown read-only."}
          </Typography>
          {canEditScores ? (
            <Button variant="contained" disabled={disabled} onClick={() => void saveRosterAndScores()}>
              Save roster + scores
            </Button>
          ) : (
            <Button variant="contained" disabled={disabled} onClick={() => void saveRoster()}>
              Save roster
            </Button>
          )}

          <Dialog open={overrideOpen != null} onClose={() => setOverrideOpen(null)}>
            <DialogTitle>President override approval</DialogTitle>
            <DialogContent>
              <TextField
                label="Reason"
                fullWidth
                sx={{ mt: 1 }}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOverrideOpen(null)}>Cancel</Button>
              <Button variant="contained" disabled={overrideOpen == null} onClick={() => overrideOpen != null && void overrideApprove(overrideOpen)}>
                Confirm override
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function CreateMatchDialog({
  open,
  onClose,
  eventId,
  seasonTeams,
  usedTeamIDs,
  teamName,
  disabled,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  eventId: number;
  seasonTeams: SeasonTeamRow[];
  usedTeamIDs: Set<number>;
  teamName: (id: number) => string;
  disabled: boolean;
  onCreated: () => void;
  onError: (msg: string | null) => void;
}) {
  const [lane, setLane] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);
  const availableTeams = useMemo(
    () => seasonTeams.map((st) => st.teamId).filter((id) => !usedTeamIDs.has(id)),
    [seasonTeams, usedTeamIDs],
  );
  const canSubmit = !disabled && lane.trim() !== "" && a !== "" && b !== "" && a !== b && availableTeams.length >= 2;

  async function submit() {
    setLocalErr(null);
    onError(null);
    const teamAId = Number(a);
    const teamBId = Number(b);
    if (!lane.trim() || teamAId < 1 || teamBId < 1 || teamAId === teamBId) return;
    const res = await apiFetch(`/events/${eventId}/matches`, {
      method: "POST",
      body: JSON.stringify({ laneNumber: lane.trim(), teamAId, teamBId }),
    });
    if (!res.ok) {
      const msg = await apiErrorText(res);
      setLocalErr(msg);
      onError(msg);
      return;
    }
    onCreated();
    onClose();
    setLane("");
    setA("");
    setB("");
    setLocalErr(null);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New match</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {availableTeams.length < 2 ? (
            <Alert severity="info">All enrolled teams are already scheduled for this event.</Alert>
          ) : null}
          <TextField label="Lane label" value={lane} onChange={(e) => setLane(e.target.value)} disabled={disabled || availableTeams.length < 2} />
          <TextField select label="Team A" value={a} onChange={(e) => setA(e.target.value)} disabled={disabled || availableTeams.length < 2}>
            <MenuItem value="">
              <em>Choose…</em>
            </MenuItem>
            {availableTeams.map((tid) => (
              <MenuItem key={tid} value={String(tid)}>
                {teamName(tid)}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Team B" value={b} onChange={(e) => setB(e.target.value)} disabled={disabled || availableTeams.length < 2}>
            <MenuItem value="">
              <em>Choose…</em>
            </MenuItem>
            {availableTeams
              .filter((tid) => (a ? String(tid) !== a : true))
              .map((tid) => (
                <MenuItem key={`b-${tid}`} value={String(tid)}>
                  {teamName(tid)}
                </MenuItem>
              ))}
          </TextField>
          <Typography variant="caption" color="text.secondary">
            Only teams not yet scheduled for this event are listed.
          </Typography>
          {localErr ? <Alert severity="error">{localErr}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={!canSubmit}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function numOrNull(v: string | undefined): number | null {
  if (v == null) return null;
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.min(300, Math.max(0, Math.round(n)));
}
