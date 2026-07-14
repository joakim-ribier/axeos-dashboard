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
