import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, jsonArray } from "../api/client";
import type { Role } from "../auth/AuthContext";
import { useAuth } from "../auth/AuthContext";

type PlayerRow = {
  playerId: number;
  username: string;
  fullName: string;
  gender: string;
  isActive: boolean;
  role: Role;
  email: string | null;
  emailOptIn: boolean;
};

export function PlayersAdminPage() {
  const auth = useAuth();
  const [rows, setRows] = useState<PlayerRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<PlayerRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/players");
      if (!res.ok) {
        setErr("Could not load players.");
        setRows([]);
        return;
      }
      setRows(jsonArray<PlayerRow>(await res.json()));
      setErr(null);
    } catch {
      setErr("Could not load players.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    if (auth.status === "authenticated" && auth.me.role === "President") void load();
  }, [auth, load]);

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
      <Typography variant="h5">Players</Typography>
      {err ? <Alert severity="error">{err}</Alert> : null}
      <Button variant="contained" onClick={() => setOpen(true)} sx={{ alignSelf: "flex-start" }}>
        Add player
      </Button>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Username</TableCell>
            <TableCell>Gender</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Active</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.playerId}>
              <TableCell>{p.fullName}</TableCell>
              <TableCell>{p.username}</TableCell>
              <TableCell>{p.gender}</TableCell>
              <TableCell>{p.role}</TableCell>
              <TableCell>{p.isActive ? "yes" : "no"}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => setEdit(p)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreatePlayerDialog open={open} onClose={() => setOpen(false)} onCreated={() => void load()} />

      <EditPlayerDialog player={edit} onClose={() => setEdit(null)} onSaved={() => void load()} />

      <Typography variant="body2">
        <Link to="/">Home</Link>
      </Typography>
    </Stack>
  );
}

function CreatePlayerDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("Male");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [role, setRole] = useState<Role>("Player");

  async function submit() {
    const body = {
      username,
      fullName,
      gender,
      password,
      email: email.trim() === "" ? null : email.trim(),
      emailOptIn: optIn,
      role,
    };
    const res = await apiFetch("/players", { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) return;
    onCreated();
    onClose();
    setUsername("");
    setFullName("");
    setPassword("");
    setEmail("");
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New player</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <TextField select label="Gender" value={gender} onChange={(e) => setGender(e.target.value)}>
            <MenuItem value="Male">Male</MenuItem>
            <MenuItem value="Female">Female</MenuItem>
          </TextField>
          <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <MenuItem value="Player">Player</MenuItem>
            <MenuItem value="Captain">Captain</MenuItem>
            <MenuItem value="President">President</MenuItem>
          </TextField>
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <TextField label="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormControlLabel control={<Switch checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />} label="Email opt-in" />
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

function EditPlayerDialog({
  player,
  onClose,
  onSaved,
}: {
  player: PlayerRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("Male");
  const [active, setActive] = useState(true);
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [role, setRole] = useState<Role>("Player");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!player) return;
    setFullName(player.fullName);
    setGender(player.gender);
    setActive(player.isActive);
    setEmail(player.email ?? "");
    setOptIn(player.emailOptIn);
    setRole(player.role);
    setPassword("");
  }, [player]);

  async function submit() {
    if (!player) return;
    const body = {
      fullName,
      gender,
      isActive: active,
      email: email.trim() === "" ? null : email.trim(),
      emailOptIn: optIn,
      role,
      ...(password.trim() !== "" ? { password: password.trim() } : {}),
    };
    const res = await apiFetch(`/players/${player.playerId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!res.ok) return;
    onSaved();
    onClose();
  }

  return (
    <Dialog open={Boolean(player)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit player</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Username: {player?.username}
          </Typography>
          <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <TextField select label="Gender" value={gender} onChange={(e) => setGender(e.target.value)}>
            <MenuItem value="Male">Male</MenuItem>
            <MenuItem value="Female">Female</MenuItem>
          </TextField>
          <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <MenuItem value="Player">Player</MenuItem>
            <MenuItem value="Captain">Captain</MenuItem>
            <MenuItem value="President">President</MenuItem>
          </TextField>
          <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label="Active" />
          <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormControlLabel control={<Switch checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />} label="Email opt-in" />
          <TextField
            label="New password (optional)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
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
