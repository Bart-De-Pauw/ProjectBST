import {
  Alert,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiFetch, jsonArray } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useCurrentSeasonId } from "../hooks/useCurrentSeasonId";

type EventRow = { eventId: number; seasonId: number; eventDate: string; finalized: boolean };
type AffiliationRow = { playerId: number; teamId: number; isCaptain: boolean };

export function ScorecardHubPage() {
  const auth = useAuth();
  const authed = auth.status === "authenticated";
  const isPresident = authed && auth.me.role === "President";
  const isCaptain = authed && auth.me.role === "Captain";
  const { seasonId, loading } = useCurrentSeasonId(authed);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [affiliations, setAffiliations] = useState<AffiliationRow[]>([]);

  useEffect(() => {
    if (!seasonId || !authed) return;
    void (async () => {
      const [evRes, affRes] = await Promise.all([
        apiFetch(`/seasons/${seasonId}/events`),
        isCaptain ? apiFetch(`/seasons/${seasonId}/affiliations`) : Promise.resolve(null),
      ]);
      if (evRes.ok) setEvents(jsonArray<EventRow>(await evRes.json()));
      if (affRes?.ok) setAffiliations(jsonArray<AffiliationRow>(await affRes.json()));
    })();
  }, [seasonId, authed, isCaptain, auth.status]);

  const captainTeamIds = useMemo(() => {
    if (!authed || !isCaptain) return new Set<number>();
    const mine = auth.me.playerId;
    const ids = new Set<number>();
    for (const a of affiliations) {
      if (a.playerId === mine && a.isCaptain) ids.add(a.teamId);
    }
    return ids;
  }, [affiliations, auth, authed, isCaptain]);

  if (auth.status === "loading") {
    return <Typography sx={{ p: 2 }}>Loading session…</Typography>;
  }

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  if (!isPresident && !isCaptain) {
    return (
      <Stack spacing={2} sx={{ p: 2 }}>
        <Alert severity="info">Scorecard input is for team captains. View standings on the leaderboards page.</Alert>
        <Typography variant="body2">
          <Link to="/leaderboards">Season standings</Link>
        </Typography>
      </Stack>
    );
  }

  if (loading) {
    return <Typography sx={{ p: 2 }}>Loading scorecard events…</Typography>;
  }

  const openEvents = events.filter((e) => !e.finalized);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h5">Scorecard input</Typography>
      <Typography variant="body2" color="text.secondary">
        Enter roster slots and scratch scores for your team. Saved fields show green; unsaved edits show yellow until you
        save.
      </Typography>

      {openEvents.length === 0 ? (
        <Alert severity="info">No open events in season #{seasonId ?? "—"}.</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Event</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {openEvents.map((e) => (
              <TableRow key={e.eventId} hover>
                <TableCell>{String(e.eventDate).slice(0, 10)}</TableCell>
                <TableCell>#{e.eventId}</TableCell>
                <TableCell>Open</TableCell>
                <TableCell>
                  <Button size="small" variant="contained" component={Link} to={`/admin/events/${e.eventId}`}>
                    {isPresident ? "Manage event" : "Enter scores"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {isCaptain && captainTeamIds.size === 0 ? (
        <Alert severity="warning">
          No captain affiliation found for this season. Ask the president to mark you as captain on your team.
        </Alert>
      ) : null}
    </Stack>
  );
}
