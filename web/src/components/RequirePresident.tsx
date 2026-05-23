import { Alert, Stack, Typography } from "@mui/material";
import React from "react";
import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function RequirePresident({ children }: { children?: React.ReactNode }) {
  const auth = useAuth();

  if (auth.status === "loading") {
    return <Typography sx={{ p: 2 }}>Loading session…</Typography>;
  }

  if (auth.status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: "admin" }} />;
  }

  if (auth.me.role !== "President") {
    return (
      <Stack spacing={2} sx={{ p: 2 }}>
        <Alert severity="warning">President access required for admin pages.</Alert>
        <Typography variant="body2">
          <Link to="/leaderboards">Leaderboards</Link>
          {" · "}
          <Link to="/scorecard">Scorecard</Link>
        </Typography>
      </Stack>
    );
  }

  return children ? <>{children}</> : <Outlet />;
}
