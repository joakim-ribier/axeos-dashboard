// src/pages/settings/ElectricitySettings.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import BoltIcon from "@mui/icons-material/Bolt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DevicesOtherIcon from "@mui/icons-material/DevicesOther";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  IconButton,
  InputAdornment,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { ActionButton } from "@/components/ui/ActionButton";
import { DataTable } from "@/components/ui/DataTable";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { Writable } from "@/components/ui/Writable";
import { type PowerDevice } from "@/schemas/appSettingsSchema";

import {
  AppSettingsFrame,
  type AppSettingsFrameContext,
} from "./AppSettingsFrame";
import { SectionTitle } from "./SectionTitle";

// A French keyboard types "," as the decimal separator; Number() only
// understands ".".
const toDecimalInput = (value: string): string => {
  const [whole, ...decimals] = value
    .replace(/,/g, ".")
    .replace(/[^\d.]/g, "")
    .split(".");
  return decimals.length ? `${whole}.${decimals.join("")}` : whole;
};

const ElectricitySection = ({
  data,
  readOnly,
  isSaving,
  persist,
  serverBasePayload,
}: AppSettingsFrameContext) => {
  const { t, i18n } = useTranslation();
  const [electricityRate, setElectricityRate] = useState("");
  const [devices, setDevices] = useState<PowerDevice[]>([]);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDevicePower, setNewDevicePower] = useState("");

  // Seeds the local draft from the fetched settings -- only when data
  // itself changes (a fresh load, or right after a save resolves), never
  // on every render, so it doesn't stomp on what the operator is mid-typing.
  useEffect(() => {
    if (!data) return;
    setElectricityRate(String(data.electricity.ratePerKwh));
    setDevices(data.electricity.devices ?? []);
  }, [data]);

  // Rate and devices share the electricity block but are saved separately --
  // each one keeps the other's last confirmed server value, never wiping it.
  const handleSaveElectricity = () => {
    const base = serverBasePayload();
    return persist({
      ...base,
      electricity: {
        ...base.electricity,
        ratePerKwh: Number(electricityRate) || 0,
      },
    });
  };

  const persistDevices = (nextDevices: PowerDevice[]) => {
    setDevices(nextDevices);
    const base = serverBasePayload();
    return persist({
      ...base,
      electricity: { ...base.electricity, devices: nextDevices },
    });
  };

  const newDevicePowerValue = Number(newDevicePower);
  const isNewDeviceValid =
    newDeviceName.trim() !== "" && newDevicePowerValue > 0;

  const clearAddForm = () => {
    setNewDeviceName("");
    setNewDevicePower("");
  };

  const handleAddDevice = () => {
    if (!isNewDeviceValid) return;
    const name = newDeviceName.trim();
    clearAddForm();
    return persistDevices([
      ...devices.filter((d) => d.name !== name),
      { name, power: newDevicePowerValue },
    ]);
  };

  const handleRemoveDevice = (name: string) =>
    persistDevices(devices.filter((d) => d.name !== name));

  // Costs use the saved rate, not one still being typed above.
  const savedRate = data?.electricity.ratePerKwh ?? 0;
  const kwhPerDay = (power: number) => (power * 24) / 1000;
  const formatKwh = (kwh: number) =>
    kwh.toLocaleString(i18n.language, { maximumFractionDigits: 2 });
  const formatCost = (kwh: number) =>
    (kwh * savedRate).toLocaleString(i18n.language, {
      style: "currency",
      currency: "EUR",
    });
  const totalPower = devices.reduce((sum, d) => sum + d.power, 0);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleAddDevice();
    if (e.key === "Escape") clearAddForm();
  };

  return (
    <Stack spacing={4}>
      {/* Rate */}
      <Box>
        <SectionTitle
          icon={<BoltIcon fontSize="small" />}
          title={t("settingsPage.appSettings.electricity.rate.title")}
          description={t(
            "settingsPage.appSettings.electricity.rate.description",
          )}
        />
        {readOnly ? (
          <Typography variant="h6" sx={{ fontFamily: "monospace" }}>
            {`${savedRate.toLocaleString(i18n.language)} €/kWh`}
          </Typography>
        ) : (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <TextField
              size="small"
              label={t("settingsPage.appSettings.electricity.rateLabel")}
              value={electricityRate}
              onChange={(e) =>
                setElectricityRate(toDecimalInput(e.target.value))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSaveElectricity();
              }}
              slotProps={{
                htmlInput: { inputMode: "decimal" },
                inputLabel: { shrink: true },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">€/kWh</InputAdornment>
                  ),
                },
              }}
              sx={{ width: { sm: 240 } }}
            />
            <ActionButton
              icon={<SaveIcon fontSize="small" />}
              loading={isSaving}
              onClick={() => void handleSaveElectricity()}
            >
              {isSaving
                ? t("settingsPage.appSettings.saving")
                : t("settingsPage.appSettings.save")}
            </ActionButton>
          </Stack>
        )}
      </Box>

      <SectionDivider />

      {/* Non-miner devices */}
      <Box>
        <SectionTitle
          icon={<DevicesOtherIcon fontSize="small" />}
          title={t("settingsPage.appSettings.electricity.devices.title")}
          description={t(
            "settingsPage.appSettings.electricity.devices.description",
          )}
        />

        <DataTable>
          <TableHead>
            <TableRow>
              <TableCell>
                {t("settingsPage.appSettings.electricity.devices.nameLabel")}
              </TableCell>
              <TableCell align="right">
                {t("settingsPage.appSettings.electricity.devices.powerLabel")}
              </TableCell>
              <TableCell
                align="right"
                sx={{ display: { xs: "none", sm: "table-cell" } }}
              >
                {t("settingsPage.appSettings.electricity.devices.perDay")}
              </TableCell>
              <TableCell align="right">
                {t("settingsPage.appSettings.electricity.devices.costPerDay")}
              </TableCell>
              <Writable readOnly={readOnly}>
                <TableCell align="right" sx={{ width: 56 }} />
              </Writable>
            </TableRow>
          </TableHead>
          <TableBody>
            {devices.length === 0 && (
              <TableRow>
                <TableCell colSpan={readOnly ? 4 : 5}>
                  <Typography variant="caption" color="text.disabled">
                    {t("settingsPage.appSettings.electricity.devices.empty")}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {devices.map((device) => (
              <TableRow hover key={device.name}>
                <TableCell>{device.name}</TableCell>
                <TableCell align="right" sx={{ fontFamily: "monospace" }}>
                  {`${device.power} W`}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    display: { xs: "none", sm: "table-cell" },
                    fontFamily: "monospace",
                  }}
                >
                  {formatKwh(kwhPerDay(device.power))}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: "monospace" }}>
                  {formatCost(kwhPerDay(device.power))}
                </TableCell>
                <Writable readOnly={readOnly}>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      disabled={isSaving}
                      onClick={() => void handleRemoveDevice(device.name)}
                      aria-label={t(
                        "settingsPage.appSettings.electricity.devices.remove",
                      )}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </Writable>
              </TableRow>
            ))}
            {devices.length > 1 && (
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>
                  {t("settingsPage.appSettings.electricity.devices.total")}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontFamily: "monospace", fontWeight: 700 }}
                >
                  {`${totalPower} W`}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    display: { xs: "none", sm: "table-cell" },
                    fontFamily: "monospace",
                    fontWeight: 700,
                  }}
                >
                  {formatKwh(kwhPerDay(totalPower))}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontFamily: "monospace", fontWeight: 700 }}
                >
                  {formatCost(kwhPerDay(totalPower))}
                </TableCell>
                <Writable readOnly={readOnly}>
                  <TableCell />
                </Writable>
              </TableRow>
            )}
          </TableBody>
        </DataTable>

        {/* Always there under the table (a handful of devices at most):
            one step to add, and its fields stack full-width on a phone. */}
        <Writable readOnly={readOnly}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
            sx={{ mt: 2 }}
          >
            <TextField
              size="small"
              label={t(
                "settingsPage.appSettings.electricity.devices.nameLabel",
              )}
              placeholder={t(
                "settingsPage.appSettings.electricity.devices.namePlaceholder",
              )}
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              onKeyDown={onKeyDown}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              size="small"
              label={t(
                "settingsPage.appSettings.electricity.devices.powerLabel",
              )}
              placeholder="30"
              value={newDevicePower}
              onChange={(e) =>
                setNewDevicePower(e.target.value.replace(/\D/g, ""))
              }
              onKeyDown={onKeyDown}
              slotProps={{
                htmlInput: { inputMode: "numeric" },
                inputLabel: { shrink: true },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">W</InputAdornment>
                  ),
                },
              }}
              sx={{ width: { sm: 160 }, flexShrink: 0 }}
            />
            <ActionButton
              icon={<AddIcon fontSize="small" />}
              disabled={isSaving || !isNewDeviceValid}
              onClick={() => void handleAddDevice()}
            >
              {t("settingsPage.appSettings.electricity.devices.add")}
            </ActionButton>
          </Stack>
          {/* Under the row rather than as the field's helper text, which
              would make it taller than its neighbours. */}
          {newDevicePowerValue > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1, fontFamily: "monospace" }}
            >
              {t("settingsPage.appSettings.electricity.devices.preview", {
                kwh: formatKwh(kwhPerDay(newDevicePowerValue)),
                cost: formatCost(kwhPerDay(newDevicePowerValue)),
              })}
            </Typography>
          )}
        </Writable>
      </Box>
    </Stack>
  );
};

export const ElectricitySettings = () => (
  <AppSettingsFrame>
    {(ctx) => <ElectricitySection {...ctx} />}
  </AppSettingsFrame>
);
