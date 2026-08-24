// src/components/ui/MinerCard/components/MinerTabPanel.tsx
import { ReactNode } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Collapse, Typography } from "@mui/material";

export interface MinerTab {
  key: string;
  icon: ReactNode;
  label: string;
  content: ReactNode;
}

interface MinerTabPanelProps {
  tabs: MinerTab[];
  active: string | null;
  onSelect: (key: string) => void;
}

// A small tabs widget: clicking a tab re-selects it (toggling active back to
// none if it's already selected). No borders/rules -- the active tab is
// distinguished purely by a filled background + accent color, kept minimal
// on purpose (this sits inside an already-busy card).
export const MinerTabPanel = ({
  tabs,
  active,
  onSelect,
}: MinerTabPanelProps) => {
  const activeTab = tabs.find((tab) => tab.key === active);

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 0.5 }}>
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Box
              key={tab.key}
              onClick={() => onSelect(tab.key)}
              sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
                py: 0.6,
                borderRadius: 1,
                cursor: "pointer",
                userSelect: "none",
                backgroundColor: isActive ? "action.selected" : "transparent",
                color: isActive ? "#00b4ff" : "text.secondary",
                fontWeight: isActive ? 600 : 400,
                transition: "background 0.15s ease, color 0.15s ease",
                "&:hover": {
                  backgroundColor: isActive
                    ? "action.selected"
                    : "action.hover",
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", fontSize: 16 }}>
                {tab.icon}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: "inherit" }}>
                {tab.label}
              </Typography>
              <ExpandMoreIcon
                sx={{
                  fontSize: 16,
                  transition: "transform 0.2s",
                  transform: isActive ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </Box>
          );
        })}
      </Box>
      <Collapse in={active !== null} timeout="auto" unmountOnExit>
        <Box sx={{ pt: 1.5 }}>{activeTab?.content}</Box>
      </Collapse>
    </Box>
  );
};
