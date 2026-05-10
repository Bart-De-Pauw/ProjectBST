import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, jsonArray } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type SeasonRow = {
  seasonId: number;
  seasonName: string;
  startDate?: string | null;
  endDate?: string | null;
};

export function SeasonsAdminPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<SeasonRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/seasons");
      if (!res.ok) {
        setErr("Could not load seasons.");
        setRows([]);
        return;
      }
      setRows(jsonArray<SeasonRow>(await res.json()));
      setErr(null);
    } catch {
      setErr("Could not load seasons.");
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
      <Typography variant="h5">Seasons</Typography>
      {err ? <Alert severity="error">{err}</Alert> : null}
      <Button variant="contained" onClick={() => setOpen(true)} sx={{ alignSelf: "flex-start" }}>
        New season
      </Button>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Start</TableCell>
            <TableCell>End</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.seasonId} hover sx={{ cursor: "pointer" }} onClick={() => nav(`/admin/seasons/${s.seasonId}`)}>
              <TableCell>{s.seasonName}</TableCell>
              <TableCell>{fmtDay(s.startDate)}</TableCell>
              <TableCell>{fmtDay(s.endDate)}</TableCell>
              <TableCell>
                <Button size="small" component={Link} to={`/admin/seasons/${s.seasonId}`}>
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreateSeasonDialog open={open} onClose={() => setOpen(false)} onCreated={() => void load()} />

      <Typography variant="body2">
        <Link to="/">Home</Link>
      </Typography>
    </Stack>
  );
}

function fmtDay(iso?: string | null): string {
  if (!iso) return "—";
  const d = String(iso).slice(0, 10);
  return d || "—";
}

function CreateSeasonDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  async function submit() {
    const body = {
      seasonName: name,
      startDate: start.trim() === "" ? null : start.trim(),
      endDate: end.trim() === "" ? null : end.trim(),
    };
    const res = await apiFetch("/seasons", { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) return;
    onCreated();
    onClose();
    setName("");
    setStart("");
    setEnd("");
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New season</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Season name" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="Start date (optional)" type="date" value={start} onChange={(e) => setStart(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="End date (optional)" type="date" value={end} onChange={(e) => setEnd(e.target.value)} InputLabelProps={{ shrink: true }} />
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
