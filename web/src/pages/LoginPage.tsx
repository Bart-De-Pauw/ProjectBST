import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { login, status } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await login(username, password);
      nav("/");
    } catch {
      setErr("Invalid username or password.");
    }
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 360, mx: "auto", mt: 4, px: 2 }}>
      <Typography variant="h5">Sign in</Typography>
      {err ? <Alert severity="error">{err}</Alert> : null}
      <form onSubmit={onSubmit}>
        <Stack spacing={2}>
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            fullWidth
          />
          <Button type="submit" variant="contained" disabled={status === "loading"}>
            Sign in
          </Button>
        </Stack>
      </form>
      <Typography variant="body2">
        <Link to="/">Home</Link>
      </Typography>
    </Stack>
  );
}
