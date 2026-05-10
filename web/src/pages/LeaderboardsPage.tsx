import {
  Alert,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";

type TeamLB = { teamId: number; teamName: string; seasonPoints: number };
type PlayerLB = { playerId: number; fullName: string; totalScratch: number };

type LBResponse = {
  seasonId: number;
  mode: string;
  teams: TeamLB[];
  malePlayers: PlayerLB[];
  femalePlayers: PlayerLB[];
  note: string;
};

export function LeaderboardsPage() {
  const { seasonId: sidParam } = useParams<{ seasonId: string }>();
  const seasonId = Number(sidParam);
  const validId = Number.isFinite(seasonId) && seasonId > 0;

  const [mode, setMode] = useState<"official" | "live">("official");
  const [data, setData] = useState<LBResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!validId) return;
    const res = await apiFetch(`/public/seasons/${seasonId}/leaderboards?mode=${encodeURIComponent(mode)}`);
    if (!res.ok) {
      setErr("Could not load leaderboards.");
      setData(null);
      return;
    }
    setData(await res.json());
    setErr(null);
  }, [seasonId, mode, validId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!validId) {
    return (
      <Alert sx={{ m: 2 }}>
        Invalid season id. <Link to="/">Home</Link>
      </Alert>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h5">Season leaderboards · #{seasonId}</Typography>
      <Typography variant="body2">
        <Link to="/">Home</Link>
        {" · "}
        <Link to={`/admin/seasons/${seasonId}`}>Season admin</Link>
      </Typography>
      {err ? <Alert severity="error">{err}</Alert> : null}

      <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)}>
        <ToggleButton value="official">Official</ToggleButton>
        <ToggleButton value="live">Live</ToggleButton>
      </ToggleButtonGroup>

      {data ? <Alert severity="info">{data.note}</Alert> : null}

      <Typography variant="h6">Teams</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Team</TableCell>
            <TableCell align="right">Season points</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(data?.teams ?? []).map((t, i) => (
            <TableRow key={t.teamId}>
              <TableCell>{i + 1}</TableCell>
              <TableCell>{t.teamName}</TableCell>
              <TableCell align="right">{t.seasonPoints}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Typography variant="h6">Male scratch (season)</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Player</TableCell>
            <TableCell align="right">Pins</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(data?.malePlayers ?? []).map((p, i) => (
            <TableRow key={p.playerId}>
              <TableCell>{i + 1}</TableCell>
              <TableCell>{p.fullName}</TableCell>
              <TableCell align="right">{p.totalScratch}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Typography variant="h6">Female scratch (season)</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Player</TableCell>
            <TableCell align="right">Pins</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(data?.femalePlayers ?? []).map((p, i) => (
            <TableRow key={p.playerId}>
              <TableCell>{i + 1}</TableCell>
              <TableCell>{p.fullName}</TableCell>
              <TableCell align="right">{p.totalScratch}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}
