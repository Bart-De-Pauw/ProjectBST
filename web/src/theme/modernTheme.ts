import { createTheme, alpha } from "@mui/material/styles";

/** Modern theme color tokens (see docs/UserInterface.md). */
export const modernColors = {
  dominant: "#ffffff",
  secondary: "#f27272",
  accent: "#f7d865",
  textPrimary: "#1a1a1a",
  textSecondary: "#5c5c5c",
} as const;

export const modernTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: modernColors.accent,
      contrastText: modernColors.textPrimary,
    },
    secondary: {
      main: modernColors.secondary,
      contrastText: modernColors.dominant,
    },
    background: {
      default: modernColors.dominant,
      paper: modernColors.dominant,
    },
    text: {
      primary: modernColors.textPrimary,
      secondary: modernColors.textSecondary,
    },
    divider: alpha(modernColors.secondary, 0.35),
    success: {
      main: "#2e7d32",
      light: "#e8f5e9",
    },
    warning: {
      main: "#ed6c02",
      light: "#fff8e1",
    },
  },
  typography: {
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: modernColors.dominant,
          color: modernColors.textPrimary,
          borderBottom: `1px solid ${alpha(modernColors.secondary, 0.35)}`,
          boxShadow: "none",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: modernColors.dominant,
          borderRight: `1px solid ${alpha(modernColors.secondary, 0.35)}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: {
          borderColor: alpha(modernColors.secondary, 0.45),
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          fontWeight: 600,
          "&:hover": {
            backgroundColor: alpha(modernColors.accent, 0.85),
          },
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: modernColors.dominant,
          borderTop: `1px solid ${alpha(modernColors.secondary, 0.35)}`,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: alpha(modernColors.secondary, 0.08),
        },
      },
    },
  },
});

/** Highlight styles for leaderboard rank rows. */
export function rankRowSx(rank: number) {
  if (rank === 1) {
    return { bgcolor: alpha(modernColors.accent, 0.45), "& td": { fontWeight: 600 } };
  }
  if (rank === 2 || rank === 3) {
    return { bgcolor: alpha(modernColors.accent, 0.2) };
  }
  return undefined;
}

/** Outlined input background for saved vs draft score fields. */
export function fieldStatusSx(status: "saved" | "draft" | "empty") {
  if (status === "saved") {
    return { "& .MuiOutlinedInput-root": { bgcolor: "success.light" } };
  }
  if (status === "draft") {
    return { "& .MuiOutlinedInput-root": { bgcolor: "warning.light" } };
  }
  return undefined;
}
