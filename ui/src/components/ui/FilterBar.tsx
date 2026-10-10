// src/components/ui/FilterBar.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import FilterListIcon from "@mui/icons-material/FilterList";
import {
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { format, isSameDay, isValid } from "date-fns";
import { enUS, fr } from "date-fns/locale";

const ALL_VALUE = "__all__";
const CONTROL_SX = { minWidth: { xs: "100%", sm: 180 } };

export interface SelectFilter {
  kind: "select";
  id: string;
  label: string;
  // "" means no filter -- shown as allLabel.
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}

export interface DateFilter {
  kind: "date";
  id: string;
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  // What the filter falls back to when cleared, and what counts as "not
  // filtering": null for an optional day, today for a page that always
  // shows one day.
  defaultValue: Date | null;
}

export type Filter = SelectFilter | DateFilter;

const sameDay = (a: Date | null, b: Date | null) =>
  a === b || (!!a && !!b && isSameDay(a, b));

const isActive = (filter: Filter) =>
  filter.kind === "select"
    ? filter.value !== ""
    : !sameDay(filter.value, filter.defaultValue);

const clear = (filter: Filter) =>
  filter.kind === "select"
    ? filter.onChange("")
    : filter.onChange(filter.defaultValue);

/**
 * The filter bar shared by the history pages (Alerts, Audit): the controls
 * on one line with the page's actions (an export button) on the right, then
 * each active filter as a removable chip, with the page's summary (a count)
 * on the right of that row.
 * On a phone the controls fold behind a "Filters (n)" toggle, the chips
 * staying visible.
 */
export const FilterBar: React.FC<{
  filters: Filter[];
  summary?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ filters, summary, actions }) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  const dateLocale = i18n.language.startsWith("fr") ? fr : enUS;

  const active = filters.filter(isActive);

  const chipLabel = (filter: Filter) => {
    if (filter.kind === "date") {
      return filter.value
        ? format(filter.value, "P", { locale: dateLocale })
        : "";
    }
    return (
      filter.options.find((o) => o.value === filter.value)?.label ??
      filter.value
    );
  };

  const controls = (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        flexWrap: { sm: "wrap" },
        alignItems: { xs: "stretch", sm: "center" },
        gap: 1.5,
      }}
    >
      {filters.map((filter) =>
        filter.kind === "select" ? (
          <FormControl key={filter.id} size="small" sx={CONTROL_SX}>
            <InputLabel id={`filter-${filter.id}-label`}>
              {filter.label}
            </InputLabel>
            <Select
              labelId={`filter-${filter.id}-label`}
              label={filter.label}
              value={filter.value || ALL_VALUE}
              onChange={(e) =>
                filter.onChange(
                  e.target.value === ALL_VALUE ? "" : e.target.value,
                )
              }
            >
              <MenuItem value={ALL_VALUE}>{filter.allLabel}</MenuItem>
              {filter.options.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <LocalizationProvider
            key={filter.id}
            dateAdapter={AdapterDateFns}
            adapterLocale={dateLocale}
          >
            <DatePicker
              label={filter.label}
              value={filter.value}
              onChange={(value) =>
                filter.onChange(
                  value && isValid(value) ? value : filter.defaultValue,
                )
              }
              disableFuture
              // MUI closes on pick on desktop but waits for OK on mobile --
              // forced so both close immediately.
              closeOnSelect
              slotProps={{ textField: { size: "small", sx: CONTROL_SX } }}
            />
          </LocalizationProvider>
        ),
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        backgroundColor: "background.paper",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        {isMobile ? (
          <Button
            size="small"
            onClick={() => setOpen((o) => !o)}
            startIcon={<FilterListIcon fontSize="small" />}
          >
            {t("filterBar.filters")}
            {active.length > 0 && ` (${active.length})`}
          </Button>
        ) : (
          <>
            <FilterListIcon fontSize="small" sx={{ color: "text.secondary" }} />
            <Box sx={{ flex: 1 }}>{controls}</Box>
          </>
        )}
        {actions && <Box sx={{ ml: "auto" }}>{actions}</Box>}
      </Box>

      {isMobile && (
        <Collapse in={open} unmountOnExit>
          {controls}
        </Collapse>
      )}

      {(active.length > 0 || summary) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
            pt: 1.5,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          {active.map((filter) => (
            <Chip
              key={filter.id}
              size="small"
              label={t("filterBar.chip", {
                label: filter.label,
                value: chipLabel(filter),
              })}
              onDelete={() => clear(filter)}
            />
          ))}
          {active.length > 0 && (
            <Button size="small" onClick={() => active.forEach(clear)}>
              {t("filterBar.clearAll")}
            </Button>
          )}
          {summary && (
            <Box sx={{ ml: "auto", whiteSpace: "nowrap" }}>{summary}</Box>
          )}
        </Box>
      )}
    </Box>
  );
};
