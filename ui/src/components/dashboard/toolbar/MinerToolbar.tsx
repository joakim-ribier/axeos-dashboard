import { useTranslation } from "react-i18next";
import GridViewIcon from "@mui/icons-material/GridView";
import ViewListIcon from "@mui/icons-material/ViewList";
import {
  Box,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import { MINER_SORT_KEYS, type MinerSortKey } from "@/hooks/useMinerSort";
import { type QuickFilters } from "@/utils/minerFilters";

import { SearchField } from "./SearchField";

export const MINER_VIEWS = ["list", "tiles"] as const;
type MinerView = (typeof MINER_VIEWS)[number];

const ALL = "";

interface FilterSelectProps {
  label: string;
  options: [string, number][];
  value: string | null;
  onChange: (value: string | null) => void;
}

/** Only worth showing when there's actually a choice to make. */
const FilterSelect = ({
  label,
  options,
  value,
  onChange,
}: FilterSelectProps) => {
  const { t } = useTranslation();
  if (options.length < 2) return null;

  return (
    <TextField
      select
      size="small"
      label={label}
      value={value ?? ALL}
      onChange={(e) => onChange(e.target.value || null)}
      sx={{ width: { xs: "100%", md: "auto" }, minWidth: { md: 140 } }}
    >
      <MenuItem value={ALL}>{t("dashboard.toolbar.all")}</MenuItem>
      {options.map(([option, count]) => (
        <MenuItem key={option} value={option}>
          {`${option} (${count})`}
        </MenuItem>
      ))}
    </TextField>
  );
};

interface MinerToolbarProps {
  sort: MinerSortKey;
  onSortChange: (sort: MinerSortKey) => void;
  view: MinerView;
  onViewChange: (view: MinerView) => void;
  /** [value, number of miners] pairs. */
  models: [string, number][];
  versions: [string, number][];
  filters: QuickFilters;
  onFilterChange: (
    key: "selectedDeviceModel" | "selectedVersion",
    value: string | null,
  ) => void;
  shown: number;
  total: number;
}

export const MinerToolbar = ({
  sort,
  onSortChange,
  view,
  onViewChange,
  models,
  versions,
  filters,
  onFilterChange,
  shown,
  total,
}: MinerToolbarProps) => {
  const { t } = useTranslation();

  return (
    // A grid on a phone, so the controls line up two by two instead of
    // wrapping wherever they happen to run out of room.
    <Box
      sx={{
        display: { xs: "grid", md: "flex" },
        gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <SearchField />
      <TextField
        select
        size="small"
        label={t("dashboard.toolbar.sort")}
        value={sort}
        onChange={(e) => onSortChange(e.target.value as MinerSortKey)}
        sx={{ minWidth: { md: 180 }, gridColumn: "1 / -1" }}
      >
        {MINER_SORT_KEYS.map((key) => (
          <MenuItem key={key} value={key}>
            {t(`dashboard.sort.${key}`)}
          </MenuItem>
        ))}
      </TextField>
      <FilterSelect
        label={t("dashboard.toolbar.model")}
        options={models}
        value={filters.selectedDeviceModel}
        onChange={(v) => onFilterChange("selectedDeviceModel", v)}
      />
      <FilterSelect
        label={t("dashboard.toolbar.firmware")}
        options={versions}
        value={filters.selectedVersion}
        onChange={(v) => onFilterChange("selectedVersion", v)}
      />
      <ToggleButtonGroup
        size="small"
        exclusive
        // Phones always get tiles (see Home), nothing to switch there.
        sx={{ display: { xs: "none", md: "inline-flex" } }}
        value={view}
        onChange={(_, next: MinerView | null) => next && onViewChange(next)}
      >
        <ToggleButton value="list" aria-label={t("dashboard.toolbar.list")}>
          <ViewListIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="tiles" aria-label={t("dashboard.toolbar.tiles")}>
          <GridViewIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ display: { xs: "none", md: "block" }, ml: "auto" }}
      >
        {t("dashboard.toolbar.count", { shown, total })}
      </Typography>
    </Box>
  );
};
