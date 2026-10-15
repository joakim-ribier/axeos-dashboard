// src/components/ui/SecretField.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  IconButton,
  InputAdornment,
  TextField,
  type TextFieldProps,
} from "@mui/material";

/**
 * A text field for a secret (API key, password): masked, with an eye to
 * show or hide what's typed -- the one look every secret input shares.
 */
export const SecretField = (props: Omit<TextFieldProps, "type">) => {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);

  return (
    <TextField
      {...props}
      type={shown ? "text" : "password"}
      slotProps={{
        ...props.slotProps,
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                edge="end"
                onClick={() => setShown((s) => !s)}
                aria-label={t(
                  shown ? "common.hideSecret" : "common.showSecret",
                )}
              >
                {shown ? (
                  <VisibilityOffIcon fontSize="small" />
                ) : (
                  <VisibilityIcon fontSize="small" />
                )}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
};
