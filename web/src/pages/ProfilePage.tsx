import {
  Alert,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function ProfilePage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    setEmail(auth.me.email ?? "");
    setOptIn(auth.me.emailOptIn);
  }, [auth]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const body = { email: email.trim() === "" ? null : email.trim(), emailOptIn: optIn };
    const res = await apiFetch("/profile", { method: "PUT", body: JSON.stringify(body) });
    if (!res.ok) {
      setErr("Could not save profile.");
      return;
    }
    setMsg("Saved.");
    await auth.refresh();
  }

  if (auth.status === "loading") return <Typography sx={{ p: 2 }}>Loading…</Typography>;
  if (auth.status !== "authenticated") {
    return (
      <Alert sx={{ m: 2 }}>
        Please <Link to="/login">sign in</Link>.
      </Alert>
    );
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 480, mx: "auto", mt: 4, px: 2 }}>
      <Typography variant="h5">Email & mailings</Typography>
      <Typography variant="body2" color="text.secondary">
        Logged in as {auth.me.username} ({auth.me.role})
      </Typography>
      {msg ? <Alert severity="success">{msg}</Alert> : null}
      {err ? <Alert severity="error">{err}</Alert> : null}
      <form onSubmit={save}>
        <Stack spacing={2}>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
          <FormControlLabel
            control={<Switch checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />}
            label="Opt in to league email digests"
          />
          <Button type="submit" variant="contained">
            Save
          </Button>
        </Stack>
      </form>
      <Typography variant="body2">
        <Link to="/">Home</Link>
      </Typography>
    </Stack>
  );
}
