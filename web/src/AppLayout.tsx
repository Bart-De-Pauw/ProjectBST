import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import React, { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";

const drawerWidthOpen = 240;
const drawerWidthClosed = 64;
const mobileNavHeight = 56;

type Crumb = { label: string; to?: string };

function buildCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Live scores", to: "/live" }];

  if (pathname === "/live") return crumbs;
  if (pathname === "/leaderboards") return [{ label: "Standings", to: "/leaderboards" }];
  if (pathname === "/scorecard") return [{ label: "Scorecard", to: "/scorecard" }];
  if (pathname === "/admin") return [{ label: "Admin", to: "/admin" }];
  if (pathname === "/") return [{ label: "Home", to: "/" }];
  if (pathname === "/health") return [{ label: "Admin", to: "/admin" }, { label: "API health" }];
  if (pathname === "/login") return [{ label: "Sign in" }];
  if (pathname === "/profile") return [{ label: "Profile" }];
  if (pathname === "/about") return [{ label: "About" }];

  if (pathname === "/admin/players") return [{ label: "Admin", to: "/admin" }, { label: "Players" }];
  if (pathname === "/admin/teams") return [{ label: "Admin", to: "/admin" }, { label: "Teams" }];
  if (pathname === "/admin/seasons") return [{ label: "Admin", to: "/admin" }, { label: "Seasons" }];

  let m = pathname.match(/^\/admin\/seasons\/(\d+)$/);
  if (m) return [{ label: "Admin", to: "/admin" }, { label: "Season", to: "/admin/seasons" }, { label: `#${m[1]}` }];

  m = pathname.match(/^\/admin\/events\/(\d+)$/);
  if (m) return [{ label: "Scorecard", to: "/scorecard" }, { label: "Event" }, { label: `#${m[1]}` }];

  m = pathname.match(/^\/seasons\/(\d+)\/leaderboards$/);
  if (m) return [{ label: "Standings", to: "/leaderboards" }, { label: `Season #${m[1]}` }];

  m = pathname.match(/^\/events\/(\d+)\/live$/);
  if (m) return [{ label: "Live scores", to: "/live" }, { label: `Event #${m[1]}` }];

  return [{ label: pathname }];
}

type NavItemDef = { to: string; label: string; match: (path: string) => boolean };

function primaryNavItems(showScorecard: boolean, showAdmin: boolean): NavItemDef[] {
  const items: NavItemDef[] = [
    { to: "/leaderboards", label: "Leaderboards", match: (p) => p.startsWith("/leaderboards") || p.includes("/leaderboards") },
    { to: "/live", label: "Live scores", match: (p) => p === "/live" || /^\/events\/\d+\/live$/.test(p) },
  ];
  if (showScorecard) {
    items.push({
      to: "/scorecard",
      label: "Scorecard",
      match: (p) => p === "/scorecard" || /^\/admin\/events\/\d+$/.test(p),
    });
  }
  if (showAdmin) {
    items.push({ to: "/admin", label: "Admin", match: (p) => p.startsWith("/admin") });
  }
  return items;
}

export function AppLayout() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [collapsed, setCollapsed] = useState(false);

  const authed = auth.status === "authenticated";
  const isPresident = authed && auth.me.role === "President";
  const isCaptain = authed && auth.me.role === "Captain";
  const showScorecard = isPresident || isCaptain;
  const showAdmin = isPresident;

  const navItems = useMemo(
    () => primaryNavItems(showScorecard, showAdmin),
    [showScorecard, showAdmin],
  );

  const crumbs = useMemo(() => buildCrumbs(location.pathname), [location.pathname]);
  const drawerWidth = collapsed ? drawerWidthClosed : drawerWidthOpen;

  const mobileTab = useMemo(() => {
    if (location.pathname === "/live" || /^\/events\/\d+\/live$/.test(location.pathname)) return "/live";
    if (location.pathname.startsWith("/leaderboards") || location.pathname.includes("/leaderboards")) return "/leaderboards";
    return "/live";
  }, [location.pathname]);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          {!isMobile ? (
            <Button color="inherit" variant="outlined" size="small" onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? "»" : "«"}
            </Button>
          ) : null}
          <Typography variant="h6" component={Link} to="/live" sx={{ color: "inherit", textDecoration: "none", fontWeight: 700 }}>
            BST Bowling
          </Typography>
          <Breadcrumbs aria-label="breadcrumb" sx={{ flex: 1, display: { xs: "none", sm: "flex" } }}>
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
          <Typography variant="body2" color="inherit" sx={{ opacity: 0.9, display: { xs: "none", md: "block" } }}>
            {auth.status === "authenticated"
              ? `${auth.me.username} (${auth.me.role})`
              : auth.status === "anonymous"
                ? "Not signed in"
                : "Loading…"}
          </Typography>
          {isMobile ? (
            <Button color="inherit" size="small" component={Link} to="/about" sx={{ minWidth: 0, px: 1 }}>
              About
            </Button>
          ) : null}
          {auth.status === "anonymous" ? (
            <Button color="inherit" size="small" component={Link} to="/login">
              Sign in
            </Button>
          ) : auth.status === "authenticated" ? (
            <Button color="inherit" size="small" component={Link} to="/profile">
              Profile
            </Button>
          ) : null}
        </Toolbar>
      </AppBar>

      {!isMobile ? (
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
            {navItems.map((item) => (
              <NavItem key={item.to} to={item.to} label={item.label} collapsed={collapsed} active={item.match(location.pathname)} />
            ))}
            <Divider sx={{ my: 1 }} />
            {authed ? (
              <NavItem to="/profile" label="Profile" collapsed={collapsed} active={location.pathname === "/profile"} />
            ) : (
              <NavItem to="/login" label="Sign in" collapsed={collapsed} active={location.pathname === "/login"} />
            )}
            <NavItem to="/about" label="About" collapsed={collapsed} active={location.pathname === "/about"} />
          </List>
        </Drawer>
      ) : null}

      <Box
        component="main"
        sx={{
          flex: 1,
          p: 2,
          pt: 10,
          pb: isMobile ? `${mobileNavHeight + 16}px` : 2,
          bgcolor: "background.default",
        }}
      >
        <Outlet />
      </Box>

      {isMobile ? (
        <BottomNavigation
          value={mobileTab}
          onChange={(_, value: string) => navigate(value)}
          showLabels
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (t) => t.zIndex.drawer + 1,
            height: mobileNavHeight,
          }}
        >
          <BottomNavigationAction label="Live scores" value="/live" />
          <BottomNavigationAction label="Standings" value="/leaderboards" />
          {showScorecard ? <BottomNavigationAction label="Scorecard" value="/scorecard" /> : null}
        </BottomNavigation>
      ) : null}
    </Box>
  );
}

function NavItem({
  to,
  label,
  collapsed,
  active,
}: {
  to: string;
  label: string;
  collapsed: boolean;
  active: boolean;
}) {
  return (
    <ListItemButton component={Link} to={to} selected={active} sx={{ px: collapsed ? 1 : 2 }}>
      <ListItemText primary={collapsed ? label.slice(0, 1) : label} primaryTypographyProps={{ noWrap: true, fontWeight: active ? 600 : 400 }} />
    </ListItemButton>
  );
}
