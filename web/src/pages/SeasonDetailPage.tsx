import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, jsonArray } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type TeamRef = { teamId: number; teamName: string };
type SeasonTeamRow = { seasonId: number; teamId: number; seasonPoints: number };
type AffiliationRow = { seasonId: number; playerId: number; teamId: number; isCaptain: boolean };
type PlayerRow = { playerId: number; fullName: string; username: string };
type EventRow = { eventId: number; seasonId: number; eventDate: string; finalized: boolean };

export function SeasonDetailPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const { seasonId: sidParam } = useParams<{ seasonId: string }>();
  const seasonId = Number(sidParam);
  const validId = Number.isFinite(seasonId) && seasonId > 0;

  const [seasonTeams, setSeasonTeams] = useState<SeasonTeamRow[]>([]);
  const [allTeams, setAllTeams] = useState<TeamRef[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [affiliations, setAffiliations] = useState<AffiliationRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [affOpen, setAffOpen] = useState(false);

  const load = useCallback(async () => {
    if (!validId) return;
    const [stRes, tRes, pRes, aRes, eRes] = await Promise.all([
      apiFetch(`/seasons/${seasonId}/teams`),
      apiFetch("/teams"),
      apiFetch("/players"),
      apiFetch(`/seasons/${seasonId}/affiliations`),
      apiFetch(`/seasons/${seasonId}/events`),
    ]);
    if (!stRes.ok || !tRes.ok || !pRes.ok || !aRes.ok || !eRes.ok) {
      setErr("Could not load season details.");
      return;
    }
    setSeasonTeams(jsonArray<SeasonTeamRow>(await stRes.json()));
    setAllTeams(jsonArray<TeamRef>(await tRes.json()));
    setPlayers(jsonArray<PlayerRow>(await pRes.json()));
    setAffiliations(jsonArray<AffiliationRow>(await aRes.json()));
    setEvents(jsonArray<EventRow>(await eRes.json()));
    setErr(null);
  }, [seasonId, validId]);

  useEffect(() => {
    if (auth.status === "authenticated" && auth.me.role === "President" && validId) void load();
  }, [auth, load, validId]);

  const enrolledIds = useMemo(() => new Set(seasonTeams.map((r) => r.teamId)), [seasonTeams]);
  const teamsToAdd = useMemo(() => allTeams.filter((t) => !enrolledIds.has(t.teamId)), [allTeams, enrolledIds]);

  async function addTeamToSeason(teamId: number) {
    const res = await apiFetch(`/seasons/${seasonId}/teams`, {
      method: "POST",
      body: JSON.stringify({ teamId }),
    });
    if (!res.ok) {
      setErr("Could not add team.");
      return;
    }
    void load();
  }

  async function removeTeamFromSeason(teamId: number) {
    const res = await apiFetch(`/seasons/${seasonId}/teams/${teamId}`, { method: "DELETE" });
    if (!res.ok) {
      setErr("Could not remove team.");
      return;
    }
    void load();
  }

  if (auth.status === "loading") return <Typography sx={{ p: 2 }}>Loading…</Typography>;
  if (auth.status !== "authenticated" || auth.me.role !== "President") {
    return (
      <Alert sx={{ m: 2 }}>
        President access required. <Link to="/login">Sign in</Link>.
      </Alert>
    );
  }
  if (!validId) {
    return (
      <Alert sx={{ m: 2 }}>
        Invalid season. <Link to="/admin/seasons">Back</Link>
      </Alert>
    );
  }

  function teamName(id: number): string {
    return allTeams.find((t) => t.teamId === id)?.teamName ?? `#${id}`;
  }

  function playerLabel(id: number): string {
    const p = players.find((x) => x.playerId === id);
    return p ? `${p.fullName} (${p.username})` : `#${id}`;
  }

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h5">Season #{seasonId}</Typography>
      <Typography variant="body2">
        <Link to="/admin/seasons">All seasons</Link>
        {" · "}
        <Link to={`/seasons/${seasonId}/leaderboards`}>Public leaderboards</Link>
      </Typography>
      {err ? <Alert severity="error">{err}</Alert> : null}

      <Typography variant="h6">Teams in season</Typography>
      <AddSeasonTeamPicker teams={teamsToAdd} onAdd={(id) => void addTeamToSeason(id)} />
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Team</TableCell>
            <TableCell align="right">Season points</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {seasonTeams.map((r) => (
            <TableRow key={r.teamId}>
              <TableCell>{teamName(r.teamId)}</TableCell>
              <TableCell align="right">{r.seasonPoints}</TableCell>
              <TableCell>
                <Button size="small" color="warning" onClick={() => void removeTeamFromSeason(r.teamId)}>
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Player affiliations</Typography>
        <Button variant="outlined" size="small" onClick={() => setAffOpen(true)}>
          Add / update affiliation
        </Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Player</TableCell>
            <TableCell>Team</TableCell>
            <TableCell>Captain</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {affiliations.map((a, i) => (
            <TableRow key={`${a.playerId}-${a.teamId}-${i}`}>
              <TableCell>{playerLabel(a.playerId)}</TableCell>
              <TableCell>{teamName(a.teamId)}</TableCell>
              <TableCell>{a.isCaptain ? "yes" : "no"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Events</Typography>
        <Button variant="contained" size="small" onClick={() => setEventOpen(true)}>
          New event
        </Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Status</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((e) => (
            <TableRow key={e.eventId} hover sx={{ cursor: "pointer" }} onClick={() => nav(`/admin/events/${e.eventId}`)}>
              <TableCell>{fmtDay(e.eventDate)}</TableCell>
              <TableCell>{e.finalized ? "Finalized" : "Open"}</TableCell>
              <TableCell>
                <Button size="small" component={Link} to={`/admin/events/${e.eventId}`}>
                  Manage
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreateEventDialog seasonId={seasonId} open={eventOpen} onClose={() => setEventOpen(false)} onCreated={() => void load()} />

      <UpsertAffiliationDialog
        seasonId={seasonId}
        seasonTeams={seasonTeams}
        players={players}
        teamName={teamName}
        open={affOpen}
        onClose={() => setAffOpen(false)}
        onSaved={() => void load()}
      />

      <Typography variant="body2">
        <Link to="/">Home</Link>
      </Typography>
    </Stack>
  );
}

function fmtDay(iso: string): string {
  return String(iso).slice(0, 10);
}

function AddSeasonTeamPicker({ teams, onAdd }: { teams: TeamRef[]; onAdd: (id: number) => void }) {
  const [pick, setPick] = useState("");
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField select label="Add enrolled team" size="small" sx={{ minWidth: 260 }} value={pick} onChange={(e) => setPick(e.target.value)}>
        <MenuItem value="">
          <em>Choose…</em>
        </MenuItem>
        {teams.map((t) => (
          <MenuItem key={t.teamId} value={String(t.teamId)}>
            {t.teamName}
          </MenuItem>
        ))}
      </TextField>
      <Button
        size="small"
        variant="outlined"
        disabled={!pick}
        onClick={() => {
          onAdd(Number(pick));
          setPick("");
        }}
      >
        Add
      </Button>
    </Stack>
  );
}

function CreateEventDialog({
  seasonId,
  open,
  onClose,
  onCreated,
}: {
  seasonId: number;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [day, setDay] = useState("");

  async function submit() {
    const res = await apiFetch(`/seasons/${seasonId}/events`, {
      method: "POST",
      body: JSON.stringify({ eventDate: day }),
    });
    if (!res.ok) return;
    onCreated();
    onClose();
    setDay("");
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>New event</DialogTitle>
      <DialogContent>
        <TextField label="Event date" type="date" fullWidth sx={{ mt: 1 }} value={day} onChange={(e) => setDay(e.target.value)} InputLabelProps={{ shrink: true }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={!day}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function UpsertAffiliationDialog({
  seasonId,
  seasonTeams,
  players,
  teamName,
  open,
  onClose,
  onSaved,
}: {
  seasonId: number;
  seasonTeams: SeasonTeamRow[];
  players: PlayerRow[];
  teamName: (id: number) => string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [playerId, setPlayerId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [isCaptain, setIsCaptain] = useState(false);

  async function submit() {
    const pid = Number(playerId);
    const tid = Number(teamId);
    if (!pid || !tid) return;
    const res = await apiFetch(`/seasons/${seasonId}/affiliations`, {
      method: "POST",
      body: JSON.stringify({ playerId: pid, teamId: tid, isCaptain }),
    });
    if (!res.ok) return;
    onSaved();
    onClose();
    setPlayerId("");
    setTeamId("");
    setIsCaptain(false);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Player ↔ team</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Player" value={playerId} onChange={(e) => setPlayerId(e.target.value)} required>
            <MenuItem value="">
              <em>Choose…</em>
            </MenuItem>
            {players.map((p) => (
              <MenuItem key={p.playerId} value={String(p.playerId)}>
                {p.fullName} ({p.username})
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Team (must be enrolled)" value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
            <MenuItem value="">
              <em>Choose…</em>
            </MenuItem>
            {seasonTeams.map((st) => (
              <MenuItem key={st.teamId} value={String(st.teamId)}>
                {teamName(st.teamId)}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel control={<Checkbox checked={isCaptain} onChange={(e) => setIsCaptain(e.target.checked)} />} label="Captain for this team (season)" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={!playerId || !teamId}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
