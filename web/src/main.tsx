import React from "react";
import ReactDOM from "react-dom/client";
import { Alert, CssBaseline, ThemeProvider, createTheme, Typography } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppLayout } from "./AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { PlayersAdminPage } from "./pages/PlayersAdminPage";
import { TeamsAdminPage } from "./pages/TeamsAdminPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SeasonsAdminPage } from "./pages/SeasonsAdminPage";
import { SeasonDetailPage } from "./pages/SeasonDetailPage";
import { EventAdminPage } from "./pages/EventAdminPage";
import { LeaderboardsPage } from "./pages/LeaderboardsPage";

const theme = createTheme({ palette: { mode: "dark" } });
const queryClient = new QueryClient();

class RouteErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16 }}>
          <Alert severity="error">
            <Typography variant="subtitle1">Something crashed while rendering this page.</Typography>
            <Typography component="pre" sx={{ whiteSpace: "pre-wrap", mt: 1, fontSize: 12 }}>
              {this.state.error.message}
            </Typography>
          </Alert>
          <Typography sx={{ mt: 2 }}>
            <Link to="/">Home</Link>
          </Typography>
        </div>
      );
    }
    return this.props.children;
  }
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return <RouteErrorBoundary key={location.pathname}>{children}</RouteErrorBoundary>;
}

function Home() {
  const auth = useAuth();
  return (
    <div style={{ padding: 16 }}>
      <h1>Bowling Competition Manager ISSUE 1</h1>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {auth.status === "authenticated"
          ? `Signed in as ${auth.me.username} (${auth.me.role})`
          : auth.status === "anonymous"
            ? "Not signed in"
            : "Loading session…"}
      </Typography>
      <ul>
        <li>
          <Link to="/health">API health</Link>
        </li>
        <li>
          <Link to="/login">Sign in</Link>
        </li>
        <li>
          <Link to="/profile">Profile / email</Link>
        </li>
        <li>
          <Link to="/admin/players">Players (President)</Link>
        </li>
        <li>
          <Link to="/admin/teams">Teams (President)</Link>
        </li>
        <li>
          <Link to="/admin/seasons">Seasons & events (President)</Link>
        </li>
        {auth.status === "authenticated" ? (
          <li>
            <button type="button" onClick={() => void auth.logout()}>
              Sign out
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function Health() {
  return (
    <div style={{ padding: 16 }}>
      <h2>API health</h2>
      <Alert severity="info" sx={{ mb: 2 }}>
        The UI calls the API via <code>/api/*</code> (Vite proxy in dev; nginx in prod Compose).
      </Alert>
      <p>
        Open <a href="/api/healthz">/api/healthz</a>.
      </p>
      <p>
        <Link to="/">Back</Link>
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <RoutedErrorBoundary>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/health" element={<Health />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/admin/players" element={<PlayersAdminPage />} />
                  <Route path="/admin/teams" element={<TeamsAdminPage />} />
                  <Route path="/admin/seasons" element={<SeasonsAdminPage />} />
                  <Route path="/admin/seasons/:seasonId" element={<SeasonDetailPage />} />
                  <Route path="/admin/events/:eventId" element={<EventAdminPage />} />
                  <Route path="/seasons/:seasonId/leaderboards" element={<LeaderboardsPage />} />
                </Route>
              </Routes>
            </RoutedErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

