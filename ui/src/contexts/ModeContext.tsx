import { createContext, useContext } from "react";
import { useParams } from "react-router-dom";

type Mode = "local" | "remote";

interface ApiPaths {
  miners: string;
  history: string;
  stats: (ip: string) => string;
}

interface ModeContextValue {
  mode: Mode;
  boardId: string | undefined;
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
          history: `/api/${boardId}/miners/history`,
          stats: (ip: string) => `/api/${boardId}/${ip}/stats`,
        }
      : {
          miners: "/api/miners",
          history: "/api/miners/history",
          stats: (ip: string) => `/api/miners/${ip}/stats`,
        };

  return (
    <ModeContext.Provider value={{ mode, boardId, apiPaths }}>
      {children}
    </ModeContext.Provider>
  );
};
