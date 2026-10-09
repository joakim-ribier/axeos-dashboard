import { useState } from "react";
import { useTranslation } from "react-i18next";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SearchIcon from "@mui/icons-material/Search";
import {
  IconButton,
  InputAdornment,
  Popover,
  TextField,
  Typography,
} from "@mui/material";

import { useSearch } from "@/contexts/SearchContext";

const HELP_KEYS = [
  "search.helpPlain",
  "search.helpCompare",
  "search.helpKeywords",
  "search.helpExclude",
  "search.helpCombine",
];

/** Same outlined field as the sort and filter selects next to it, so the
 * whole toolbar reads (and restyles) as one. */
export const SearchField = () => {
  const { t } = useTranslation();
  const { query, setQuery } = useSearch();
  const [helpAnchor, setHelpAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <TextField
        size="small"
        label={t("dashboard.toolbar.search")}
        placeholder={t("dashboard.toolbar.searchHint")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ flex: "1 1 240px", gridColumn: "1 / -1", minWidth: 0 }}
        slotProps={{
          inputLabel: { shrink: true },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  edge="end"
                  onClick={(e) => setHelpAnchor(e.currentTarget)}
                  aria-label={t("search.helpTitle")}
                >
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Popover
        anchorEl={helpAnchor}
        open={Boolean(helpAnchor)}
        onClose={() => setHelpAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { p: 1, maxWidth: 280 } } }}
      >
        <Typography
          variant="caption"
          component="div"
          sx={{ fontWeight: 700, mb: 0.5 }}
        >
          {t("search.helpTitle")}
        </Typography>
        {HELP_KEYS.map((key) => (
          <Typography key={key} variant="caption" component="div">
            {t(key)}
          </Typography>
        ))}
      </Popover>
    </>
  );
};
