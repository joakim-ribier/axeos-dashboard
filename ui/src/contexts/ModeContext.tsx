import { createContext, useContext } from "react";
import { useParams } from "react-router-dom";

type Mode = "local" | "remote";

interface ApiPaths {
  miners: string;
  stats: (ip: string) => string;
  alertsHistory: string;
}

interface ModeContextValue {
  mode: Mode;
  boardId: string | undefined;
  isRemote: boolean;
  apiPaths: ApiPaths;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export const useMode = (): ModeContextValue => {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
};

interface ModeProviderProps {
  mode: Mode;
  children: React.ReactNode;
}

export const ModeProvider = ({ mode, children }: ModeProviderProps) => {
  const { boardId } = useParams<{ boardId: string }>();

  const apiPaths: ApiPaths =
    mode === "remote" && boardId
      ? {
          miners: `/api/${boardId}/miners`,
          stats: (ip: string) => `/api/${boardId}/${ip}/stats`,
          alertsHistory: `/api/${boardId}/miners/alerts/history`,
        }
      : {
          miners: "/api/miners",
          stats: (ip: string) => `/api/miners/${ip}/stats`,
          alertsHistory: "/api/miners/alerts/history",
        };

  return (
    <ModeContext.Provider
      value={{ mode, boardId, isRemote: mode === "remote", apiPaths }}
    >
      {children}
    </ModeContext.Provider>
  );
};
