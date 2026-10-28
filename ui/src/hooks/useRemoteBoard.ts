// src/hooks/useRemoteBoard.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";

import { useMode } from "@/contexts/ModeContext";
import { useServicesStatus } from "@/hooks/useServicesStatus";

const remoteBoardSchema = z.object({
  boardId: z.string().optional(),
  public: z.boolean(),
  hashboardURL: z.string().optional(),
  dashboardURL: z.string().optional(),
  lastSampleAt: z.string().optional(),
});

export type RemoteBoard = z.infer<typeof remoteBoardSchema>;

const fetchRemoteBoard = async (): Promise<RemoteBoard> => {
  const { data } = await axios.get("/api/remote/board");
  return remoteBoardSchema.parse(data);
};

/**
 * The hashboard board this instance pushes to (link + last sample hashboard
 * received) -- local mode only, and only asked once remote push is
 * configured, as GET /api/status says.
 */
export const useRemoteBoard = () => {
  const { mode } = useMode();
  const { data: status } = useServicesStatus();
  const configured = status?.remotePushConfigured ?? false;
  return useQuery<RemoteBoard, Error>({
    // Keyed by it so a push turned off drops the board's last answer
    // rather than keeping its link on screen.
    queryKey: ["remoteBoard", configured],
    queryFn: fetchRemoteBoard,
    enabled: mode === "local" && configured,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
};
