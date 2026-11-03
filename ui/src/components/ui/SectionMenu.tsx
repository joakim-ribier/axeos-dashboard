// src/components/ui/SectionMenu.tsx
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { type SvgIconComponent } from "@mui/icons-material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import {
  Box,
  Collapse,
  List,
  ListItemButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";

export interface SectionMenuItem {
  key: string;
  icon: SvgIconComponent;
  title: string;
  /** Left out when there's nothing worth a glance. */
  summary?: string;
  /** Something that needs a look -- an orange dot, the text itself only on
   * hover so the entry stays compact. */
  issue?: string;
}

interface SectionMenuProps {
  items: SectionMenuItem[];
  current: string;
  /** An entry's link, when the open section lives in the URL. */
  linkTo?: (key: string) => string;
  onSelect?: (key: string) => void;
}

const IssueDot = ({ issue }: { issue: string }) => (
  <Tooltip title={issue}>
    <Box
      role="img"
      aria-label={issue}
      sx={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: "warning.main",
        ml: "auto",
      }}
    />
  </Tooltip>
);

/** Every section with its summary and dot -- Configuration's menu, and a
 * configured miner's. */
export const SectionList = ({
  items,
  current,
  linkTo,
  onSelect,
}: SectionMenuProps) => (
  <List disablePadding>
    {items.map(({ key, icon: Icon, title, summary, issue }) => {
      const selected = key === current;
      const link = linkTo && {
        component: RouterLink,
        to: linkTo(key),
        relative: "path" as const,
      };
      return (
        <ListItemButton
          key={key}
          {...link}
          selected={selected}
          aria-current={selected ? "page" : undefined}
          onClick={() => onSelect?.(key)}
          sx={{
            gap: 1.25,
            py: 1.25,
            "& + &": { borderTop: 1, borderColor: "divider" },
            "&.Mui-selected": {
              bgcolor: "rgba(0,180,255,0.12)",
              "&:hover": { bgcolor: "rgba(0,180,255,0.16)" },
            },
          }}
        >
          <Icon
            fontSize="small"
            sx={{ color: selected ? "primary.main" : "text.secondary" }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              color={selected ? "primary.main" : "text.primary"}
            >
              {title}
            </Typography>
            {summary && (
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                component="div"
              >
                {summary}
              </Typography>
            )}
          </Box>
          {issue && <IssueDot issue={issue} />}
        </ListItemButton>
      );
    })}
  </List>
);

/** The menu in its card: a column next to the open section. */
export const SectionMenu = ({
  footer,
  ...props
}: SectionMenuProps & { footer?: React.ReactNode }) => (
  <Paper
    component="nav"
    variant="outlined"
    sx={{ borderRadius: 3, overflow: "hidden" }}
  >
    <SectionList {...props} />
    {footer}
  </Paper>
);

/** Where a column doesn't fit: a bar naming the open section, which unfolds
 * the full list. Its own dot flags a problem in another section, so it
 * can't go unnoticed while folded. */
export const SectionPicker = ({
  items,
  current,
  linkTo,
  onSelect,
  footer,
}: SectionMenuProps & { footer?: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.key === current) ?? items[0];
  const CurrentIcon = selected.icon;
  const otherIssues = items
    .filter((i) => i.key !== current && i.issue)
    .map((i) => i.issue)
    .join(" · ");

  return (
    <Paper
      component="nav"
      variant="outlined"
      sx={{ borderRadius: 3, overflow: "hidden" }}
    >
      <ListItemButton
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        sx={{ gap: 1, py: 1.25 }}
      >
        <CurrentIcon fontSize="small" sx={{ color: "primary.main" }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {selected.title}
          </Typography>
          {selected.summary && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              component="div"
            >
              {selected.summary}
            </Typography>
          )}
        </Box>
        {!open && otherIssues && <IssueDot issue={otherIssues} />}
        <KeyboardArrowDownIcon
          fontSize="small"
          sx={{
            ml: open || !otherIssues ? "auto" : 0,
            color: "text.secondary",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </ListItemButton>
      <Collapse in={open}>
        <Box sx={{ borderTop: 1, borderColor: "divider" }}>
          <SectionList
            items={items}
            current={current}
            linkTo={linkTo}
            onSelect={(key) => {
              setOpen(false);
              onSelect?.(key);
            }}
          />
          {footer}
        </Box>
      </Collapse>
    </Paper>
  );
};
