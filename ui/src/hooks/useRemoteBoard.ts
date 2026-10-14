// src/hooks/useRemoteBoard.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";

import { useMode } from "@/contexts/ModeContext";

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
 * received) -- local mode only, empty when remote push isn't configured.
 */
export const useRemoteBoard = () => {
  const { mode } = useMode();
  return useQuery<RemoteBoard, Error>({
    queryKey: ["remoteBoard"],
    queryFn: fetchRemoteBoard,
    enabled: mode === "local",
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
};
