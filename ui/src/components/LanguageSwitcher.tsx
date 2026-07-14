// src/components/LanguageSwitcher.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";

const SUPPORTED_LANGUAGES = ["en", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGUAGES)[number];

export const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();
  const [selectedLang, setSelectedLang] = useState<SupportedLang>("en");

  // Synchroniser l'état local avec i18n au montage et aux changements
  useEffect(() => {
    const normalizeLang = (lng: string): SupportedLang => {
      const short = lng.split("-")[0].toLowerCase();
      return SUPPORTED_LANGUAGES.includes(short as SupportedLang)
        ? (short as SupportedLang)
        : "en";
    };

    setSelectedLang(normalizeLang(i18n.language));
  }, [i18n.language]);

  const handleChange = (event: SelectChangeEvent<string>) => {
    const lng = event.target.value as SupportedLang;
    i18n.changeLanguage(lng);
    setSelectedLang(lng);
  };

  return (
    <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
      <InputLabel id="lang-select-label">{t("language")}</InputLabel>
      <Select
        labelId="lang-select-label"
        value={selectedLang}
        onChange={handleChange}
        label={t("language")}
      >
        <MenuItem value="en">English</MenuItem>
        <MenuItem value="fr">Français</MenuItem>
      </Select>
    </FormControl>
  );
};
