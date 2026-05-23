import { Alert, List, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";
import React from "react";
import { Link } from "react-router-dom";

export function AdminHubPage() {
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h5">Admin</Typography>
      <Alert severity="info">President-only area for league setup, seasons, and event management.</Alert>
      <List dense>
        <ListItemButton component={Link} to="/admin/players">
          <ListItemText primary="Players" secondary="Create and manage player accounts" />
        </ListItemButton>
        <ListItemButton component={Link} to="/admin/teams">
          <ListItemText primary="Teams" secondary="Team names and captain assignments" />
        </ListItemButton>
        <ListItemButton component={Link} to="/admin/seasons">
          <ListItemText primary="Seasons & events" secondary="Schedule evenings and create matchups" />
        </ListItemButton>
      </List>
      <Typography variant="subtitle2" color="text.secondary">
        Developer
      </Typography>
      <List dense>
        <ListItemButton component={Link} to="/">
          <ListItemText primary="Legacy home hub" />
        </ListItemButton>
        <ListItemButton component={Link} to="/health">
          <ListItemText primary="API health" />
        </ListItemButton>
        <ListItemButton component="a" href="/api/healthz" target="_blank" rel="noreferrer">
          <ListItemText primary="Raw health check (/api/healthz)" />
        </ListItemButton>
      </List>
    </Stack>
  );
}
