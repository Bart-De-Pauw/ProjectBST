import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useCurrentSeasonId } from "../hooks/useCurrentSeasonId";

export function LeaderboardsHubPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const authed = auth.status === "authenticated";
  const { seasonId, loading } = useCurrentSeasonId(authed);
  const [manualId, setManualId] = useState("1");

  if (authed && loading) {
    return <Typography sx={{ p: 2 }}>Loading season…</Typography>;
  }

  if (authed && seasonId) {
    return <Navigate to={`/seasons/${seasonId}/leaderboards`} replace />;
  }

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h5">Season standings</Typography>
      <Typography variant="body2" color="text.secondary">
        Official and live leaderboard views for a season. Live standings may change until events are finalized.
      </Typography>

      {!authed ? (
        <Alert severity="info">
          Leaderboards are public. Sign in to jump to the current season automatically.
        </Alert>
      ) : (
        <Alert severity="warning">Could not load seasons. Enter a season number below.</Alert>
      )}

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <TextField
          size="small"
          label="Season #"
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          sx={{ width: 120 }}
        />
        <Button
          variant="contained"
          onClick={() => {
            const id = Number(manualId);
            if (id > 0) navigate(`/seasons/${id}/leaderboards`);
          }}
        >
          View standings
        </Button>
      </Stack>

      <Typography variant="body2">
        <Link to="/live">Live scores</Link>
      </Typography>
    </Stack>
  );
}
