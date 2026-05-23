import {
  Alert,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { apiFetch, jsonArray } from "../api/client";
import { useCurrentSeasonId } from "../hooks/useCurrentSeasonId";
import { useAuth } from "../auth/AuthContext";

type EventRow = { eventId: number; seasonId: number; eventDate: string; finalized: boolean };

const LAST_EVENT_KEY = "bst.lastLiveEventId";

export function LiveScoresHubPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const authed = auth.status === "authenticated";
  const { seasonId, loading } = useCurrentSeasonId(authed);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [manualId, setManualId] = useState("");
  const [lastEventId, setLastEventId] = useState<number | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(LAST_EVENT_KEY);
    const n = raw ? Number(raw) : 0;
    if (Number.isFinite(n) && n > 0) setLastEventId(n);
  }, []);

  useEffect(() => {
    if (!seasonId) return;
    void (async () => {
      const res = await apiFetch(`/seasons/${seasonId}/events`);
      if (!res.ok) return;
      setEvents(jsonArray<EventRow>(await res.json()));
    })();
  }, [seasonId]);

  const openEvents = events.filter((e) => !e.finalized);

  useEffect(() => {
    if (openEvents.length === 1) {
      sessionStorage.setItem(LAST_EVENT_KEY, String(openEvents[0].eventId));
      navigate(`/events/${openEvents[0].eventId}/live`, { replace: true });
    }
  }, [openEvents, navigate]);

  if (authed && loading) {
    return <Typography sx={{ p: 2 }}>Loading live events…</Typography>;
  }

  if (openEvents.length === 1) {
    return <Typography sx={{ p: 2 }}>Opening live view…</Typography>;
  }

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h5">Live scores</Typography>
      <Typography variant="body2" color="text.secondary">
        Watch in-progress matches and see which score slots are still missing. No login required for a specific event.
      </Typography>

      {lastEventId ? (
        <Alert severity="info">
          Continue where you left off:{" "}
          <Link to={`/events/${lastEventId}/live`}>Event #{lastEventId} live view</Link>
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Open an event by number
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <TextField
            size="small"
            label="Event #"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            sx={{ width: 120 }}
          />
          <Button
            variant="contained"
            disabled={!manualId.trim()}
            onClick={() => {
              const id = Number(manualId);
              if (id > 0) {
                sessionStorage.setItem(LAST_EVENT_KEY, String(id));
                navigate(`/events/${id}/live`);
              }
            }}
          >
            Watch live
          </Button>
        </Stack>
      </Paper>

      {authed && openEvents.length > 0 ? (
        <>
          <Typography variant="h6">Open evenings{seasonId ? ` · season #${seasonId}` : ""}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Event</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {openEvents.map((e) => (
                <TableRow key={e.eventId} hover>
                  <TableCell>{String(e.eventDate).slice(0, 10)}</TableCell>
                  <TableCell>#{e.eventId}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      component={Link}
                      to={`/events/${e.eventId}/live`}
                      onClick={() => sessionStorage.setItem(LAST_EVENT_KEY, String(e.eventId))}
                    >
                      Live view
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : authed && seasonId && !loading ? (
        <Alert severity="info">No open events in the current season. Enter an event number above or check back later.</Alert>
      ) : !authed ? (
        <Alert severity="info">
          Sign in to see open events for the current season, or enter an event number if you know it.
        </Alert>
      ) : null}
    </Stack>
  );
}

export function rememberLiveEventId(eventId: number) {
  sessionStorage.setItem(LAST_EVENT_KEY, String(eventId));
}
