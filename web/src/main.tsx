import React from "react";
import ReactDOM from "react-dom/client";
import { Alert, CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

const theme = createTheme({ palette: { mode: "dark" } });
const queryClient = new QueryClient();

function Home() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Bowling Competition Manager</h1>
      <ul>
        <li>
          <Link to="/health">API health</Link>
        </li>
      </ul>
    </div>
  );
}

function Health() {
  return (
    <div style={{ padding: 16 }}>
      <h2>API health</h2>
      <Alert severity="info" sx={{ mb: 2 }}>
        In dev, the API is at <code>http://localhost:8080</code>. The web app will call it
        directly until we add a reverse-proxy in front.
      </Alert>
      <p>
        Open <a href="http://localhost:8080/healthz">http://localhost:8080/healthz</a>.
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
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/health" element={<Health />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

