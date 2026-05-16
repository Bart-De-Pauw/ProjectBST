import {
  AppBar,
  Box,
  Breadcrumbs,
  Button,
  Divider,
  Drawer,
  Link as MuiLink,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import React, { useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";

const drawerWidthOpen = 240;
const drawerWidthClosed = 64;

type Crumb = { label: string; to?: string };

function buildCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Home", to: "/" }];

  if (pathname === "/") return crumbs;
  if (pathname === "/health") return [...crumbs, { label: "API health" }];
  if (pathname === "/login") return [...crumbs, { label: "Sign in" }];
  if (pathname === "/profile") return [...crumbs, { label: "Profile" }];
  if (pathname === "/admin/players") return [...crumbs, { label: "Admin" }, { label: "Players" }];
  if (pathname === "/admin/teams") return [...crumbs, { label: "Admin" }, { label: "Teams" }];
  if (pathname === "/admin/seasons") return [...crumbs, { label: "Admin" }, { label: "Seasons" }];

  let m = pathname.match(/^\/admin\/seasons\/(\d+)$/);
  if (m) return [...crumbs, { label: "Admin", to: "/admin/seasons" }, { label: "Season" }, { label: `#${m[1]}` }];

  m = pathname.match(/^\/admin\/events\/(\d+)$/);
  if (m) return [...crumbs, { label: "Admin", to: "/admin/seasons" }, { label: "Event" }, { label: `#${m[1]}` }];

  m = pathname.match(/^\/seasons\/(\d+)\/leaderboards$/);
  if (m) return [...crumbs, { label: "Season" }, { label: `#${m[1]}` }, { label: "Leaderboards" }];

  m = pathname.match(/^\/events\/(\d+)\/live$/);
  if (m) return [...crumbs, { label: "Live event" }, { label: `#${m[1]}` }];

  return [...crumbs, { label: pathname }];
}

export function AppLayout() {
  const auth = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const crumbs = useMemo(() => buildCrumbs(location.pathname), [location.pathname]);
  const drawerWidth = collapsed ? drawerWidthClosed : drawerWidthOpen;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          <Button color="inherit" variant="outlined" size="small" onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? "»" : "«"}
          </Button>
          <Breadcrumbs aria-label="breadcrumb" sx={{ flex: 1 }}>
            {crumbs.map((c, i) =>
              c.to ? (
                <MuiLink key={`${c.label}-${i}`} component={Link} to={c.to} underline="hover" color="inherit">
                  {c.label}
                </MuiLink>
              ) : (
                <Typography key={`${c.label}-${i}`} color="text.primary">
                  {c.label}
                </Typography>
              ),
            )}
          </Breadcrumbs>
          <Typography variant="body2" color="inherit" sx={{ opacity: 0.9 }}>
            {auth.status === "authenticated" ? `${auth.me.username} (${auth.me.role})` : auth.status === "anonymous" ? "Not signed in" : "Loading…"}
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: "border-box" },
        }}
      >
        <Toolbar />
        <List dense>
          <NavItem to="/" label="Home" collapsed={collapsed} />
          <NavItem to="/health" label="API health" collapsed={collapsed} />
          <Typography variant="caption" sx={{ px: 2, py: 1, opacity: 0.7 }} display={collapsed ? "none" : "block"}>
            Public live: /events/:id/live
          </Typography>
          <NavItem to="/profile" label="Profile" collapsed={collapsed} />
          <NavItem to="/login" label="Sign in" collapsed={collapsed} />
          <Divider sx={{ my: 1 }} />
          <NavItem to="/admin/players" label="Admin: Players" collapsed={collapsed} />
          <NavItem to="/admin/teams" label="Admin: Teams" collapsed={collapsed} />
          <NavItem to="/admin/seasons" label="Admin: Seasons" collapsed={collapsed} />
        </List>
      </Drawer>

      <Box component="main" sx={{ flex: 1, p: 2, pt: 10 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

function NavItem({ to, label, collapsed }: { to: string; label: string; collapsed: boolean }) {
  return (
    <ListItemButton component={Link} to={to} sx={{ px: collapsed ? 1 : 2 }}>
      <ListItemText
        primary={collapsed ? label.slice(0, 1) : label}
        secondary={collapsed ? undefined : undefined}
        primaryTypographyProps={{ noWrap: true }}
      />
    </ListItemButton>
  );
}

