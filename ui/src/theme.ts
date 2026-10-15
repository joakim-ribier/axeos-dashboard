// src/theme.ts
import { createTheme, ThemeOptions } from "@mui/material/styles";

export const getTheme = (mode: "light" | "dark") => {
  const base: ThemeOptions = {
    palette: {
      mode,
      background: {
        default: mode === "dark" ? "#1e1e2a" : "#f5f5f5",
        paper: mode === "dark" ? "#262637" : "#ffffff",
      },
      primary: {
        main: "#00b4ff", // accent bleu (Proton‑blue)
      },
      text: {
        primary: mode === "dark" ? "#e0e0e0" : "#212121",
        secondary: mode === "dark" ? "#b0b0b0" : "#555555",
      },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          outlined: { border: "none" },
        },
      },
      // A toast in the app's own colors, not MUI's inverted grey: a card's
      // surface and corners, the accent on its edge.
      MuiSnackbarContent: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            borderRadius: 12,
            borderLeft: `3px solid ${theme.palette.primary.main}`,
            boxShadow: theme.shadows[8],
            fontSize: "0.875rem",
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            transition: "transform 0.2s, box-shadow 0.2s",
          },
        },
      },
    },
  };
  return createTheme(base);
};
