import { Alert, Chip, Link, Paper, Stack, Table, TableBody, TableCell, TableRow, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatBuiltAtUtc, readWebBuildInfo, REPO_URL, shortCommit, type BuildInfo } from "../buildInfo";

function BuildRow({ label, info }: { label: string; info: BuildInfo }) {
  return (
    <TableRow>
      <TableCell component="th" scope="row" sx={{ fontWeight: 600, width: 72 }}>
        {label}
      </TableCell>
      <TableCell>{shortCommit(info.commit)}</TableCell>
      <TableCell>{formatBuiltAtUtc(info.builtAt)}</TableCell>
    </TableRow>
  );
}

export function AboutPage() {
  const web = readWebBuildInfo();
  const [apiInfo, setApiInfo] = useState<BuildInfo | null>(null);
  const [apiErr, setApiErr] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await apiFetch("/public/version");
      if (!res.ok) {
        setApiErr(true);
        return;
      }
      const json = (await res.json()) as BuildInfo;
      setApiInfo({
        commit: json.commit ?? "unknown",
        builtAt: json.builtAt ?? "",
        environment: json.environment ?? "dev",
      });
    })();
  }, []);

  const env = web.environment || apiInfo?.environment || "dev";

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 560 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography variant="h5">Bowling Competition Manager</Typography>
        <Chip size="small" label={env} color={env === "prod" ? "primary" : "default"} variant="outlined" />
      </Stack>

      <Typography variant="body1" color="text.secondary">
        League scoring, live standings, and season administration for BST bowling.
      </Typography>

      <Typography variant="body2">
        <Link href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub repository
        </Link>
        {" · "}
        <RouterLink to="/live">Live scores</RouterLink>
      </Typography>

      <Typography variant="h6">Build</Typography>
      <Paper variant="outlined">
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>
                Component
              </TableCell>
              <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>
                Commit
              </TableCell>
              <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>
                Built (UTC)
              </TableCell>
            </TableRow>
            <BuildRow label="Web" info={web} />
            {apiInfo ? (
              <BuildRow label="API" info={apiInfo} />
            ) : (
              <TableRow>
                <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                  API
                </TableCell>
                <TableCell colSpan={2}>
                  {apiErr ? "Could not load API version" : "Loading…"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {apiErr ? (
        <Alert severity="info">API build info unavailable — the web build details above are still valid.</Alert>
      ) : null}
    </Stack>
  );
}
