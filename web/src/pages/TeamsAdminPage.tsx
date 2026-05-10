import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormHelperText,
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
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { Role } from "../auth/AuthContext";
import { useAuth } from "../auth/AuthContext";

type PlayerOption = {
  playerId: number;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
};

type TeamRow = {
  teamId: number;
  teamName: string;
  captainId?: number | null;
};

function parseTeamsResponse(raw: unknown): TeamRow[] {
  if (!Array.isArray(raw)) return [];
  const out: TeamRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const teamId = Number(o.teamId ?? o.team_id);
    if (!Number.isFinite(teamId) || teamId < 1) continue;
    const nameRaw = o.teamName ?? o.team_name;
    const teamName = typeof nameRaw === "string" ? nameRaw : "";
    const cRaw = o.captainId ?? o.captain_id;
    let captainId: number | null | undefined;
    if (cRaw === null || cRaw === undefined) captainId = cRaw as undefined;
    else if (typeof cRaw === "number" && Number.isFinite(cRaw)) captainId = cRaw;
    else if (typeof cRaw === "string" && cRaw.trim() !== "") {
      const n = Number(cRaw);
      if (Number.isFinite(n)) captainId = n;
    }
    out.push({ teamId, teamName, captainId });
  }
  return out;
}

function captainDisplay(id: TeamRow["captainId"], byId: Map<number, PlayerOption>): string {
  if (id === null || id === undefined) return "—";
  if (typeof id !== "number" || !Number.isFinite(id)) return "—";
  const p = byId.get(id);
  return p ? `${p.fullName} (${p.username})` : `#${id}`;
}

export function TeamsAdminPage() {
  const auth = useAuth();
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<TeamRow | null>(null);

  const playersById = useMemo(() => {
    const m = new Map<number, PlayerOption>();
    for (const p of players) m.set(p.playerId, p);
    return m;
  }, [players]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/teams");
      if (!res.ok) {
        const body = await res.text();
        setErr(body ? `Could not load teams (${res.status}): ${body}` : `Could not load teams (${res.status}).`);
        setRows([]);
        return;
      }
      const payload: unknown = await res.json();
      const parsed = parseTeamsResponse(payload);
      if (!Array.isArray(payload)) {
        setErr("Teams API returned an unexpected payload (expected a JSON array).");
      } else {
        setErr(null);
      }
      setRows(parsed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load teams (network or JSON error).");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    if (auth.status === "authenticated" && auth.me.role === "President") void load();
  }, [auth, load]);

  useEffect(() => {
    if (auth.status !== "authenticated" || auth.me.role !== "President") return;
    void (async () => {
      try {
        const res = await apiFetch("/players");
        if (!res.ok) return;
        const raw: unknown = await res.json();
        if (!Array.isArray(raw)) return;
        const list: PlayerOption[] = [];
        for (const item of raw) {
          if (!item || typeof item !== "object") continue;
          const o = item as Record<string, unknown>;
          const playerId = Number(o.playerId ?? o.player_id);
          if (!Number.isFinite(playerId)) continue;
          list.push({
            playerId,
            username: typeof o.username === "string" ? o.username : "",
            fullName: typeof o.fullName === "string" ? o.fullName : "",
            role: (typeof o.role === "string" ? o.role : "Player") as Role,
            isActive: Boolean(o.isActive),
          });
        }
        setPlayers(list);
      } catch {
        /* ignore */
      }
    })();
  }, [auth]);

  if (auth.status === "loading") return <Typography sx={{ p: 2 }}>Loading…</Typography>;
  if (auth.status !== "authenticated" || auth.me.role !== "President") {
    return (
      <Alert sx={{ m: 2 }}>
        President access required. <Link to="/login">Sign in</Link>.
      </Alert>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h5">Teams</Typography>
      {err ? <Alert severity="error">{err}</Alert> : null}
      <Button variant="contained" onClick={() => setOpen(true)} sx={{ alignSelf: "flex-start" }}>
        Add team
      </Button>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Captain</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.teamId}>
              <TableCell>{t.teamName}</TableCell>
              <TableCell>{captainDisplay(t.captainId, playersById)}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => setEdit(t)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreateTeamDialog players={players} open={open} onClose={() => setOpen(false)} onCreated={() => void load()} />

      <EditTeamDialog players={players} team={edit} onClose={() => setEdit(null)} onSaved={() => void load()} />

      <Typography variant="body2">
        <Link to="/">Home</Link>
      </Typography>
    </Stack>
  );
}

function activeCaptains(players: PlayerOption[]): PlayerOption[] {
  return players
    .filter((p) => p.isActive && p.role === "Captain")
    .slice()
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function captainDropdownChoices(players: PlayerOption[], currentCaptainId: number | null | undefined): PlayerOption[] {
  const captains = activeCaptains(players);
  const byId = new Map(captains.map((p) => [p.playerId, p]));
  if (currentCaptainId != null && Number.isFinite(currentCaptainId)) {
    const cur = players.find((p) => p.playerId === currentCaptainId);
    if (cur && !byId.has(cur.playerId)) {
      captains.push(cur);
      byId.set(cur.playerId, cur);
    }
  }
  return captains.slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function CreateTeamDialog({
  players,
  open,
  onClose,
  onCreated,
}: {
  players: PlayerOption[];
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [captainId, setCaptainId] = useState("");

  const choices = useMemo(() => activeCaptains(players), [players]);

  async function submit() {
    const cid = captainId.trim() === "" ? null : Number(captainId);
    const body = { teamName: name, captainId: cid && !Number.isNaN(cid) ? cid : null };
    const res = await apiFetch("/teams", { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) return;
    onCreated();
    onClose();
    setName("");
    setCaptainId("");
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New team</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Team name" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField
            select
            label="Captain (optional)"
            value={captainId}
            onChange={(e) => setCaptainId(e.target.value)}
            helperText={choices.length === 0 ? "No active players with Captain role — set role under Players admin." : undefined}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {choices.map((p) => (
              <MenuItem key={p.playerId} value={String(p.playerId)}>
                {p.fullName} ({p.username})
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void submit()}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EditTeamDialog({
  players,
  team,
  onClose,
  onSaved,
}: {
  players: PlayerOption[];
  team: TeamRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [captainId, setCaptainId] = useState("");

  const choices = useMemo(() => captainDropdownChoices(players, team?.captainId ?? null), [players, team?.captainId]);

  useEffect(() => {
    if (!team) return;
    setName(team.teamName);
    setCaptainId(team.captainId != null ? String(team.captainId) : "");
  }, [team]);

  async function submit() {
    if (!team) return;
    const cid = captainId.trim() === "" ? null : Number(captainId);
    const body = { teamName: name, captainId: cid && !Number.isNaN(cid) ? cid : null };
    const res = await apiFetch(`/teams/${team.teamId}`, { method: "PATCH", body: JSON.stringify(body) });
    if (!res.ok) return;
    onSaved();
    onClose();
  }

  return (
    <Dialog open={Boolean(team)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit team</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Team name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField select label="Captain (optional)" value={captainId} onChange={(e) => setCaptainId(e.target.value)}>
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {choices.map((p) => (
              <MenuItem key={p.playerId} value={String(p.playerId)}>
                {p.fullName} ({p.username})
                {p.role !== "Captain" ? " · not Captain role" : ""}
              </MenuItem>
            ))}
          </TextField>
          {choices.length === 0 ? (
            <FormHelperText>No captain candidates — create Captain-role players under Players admin.</FormHelperText>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void submit()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
