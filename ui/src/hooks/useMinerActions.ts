// src/hooks/useMinerAction.ts
import { useState } from "react";
import axios from "axios";

export interface UseMinerActionReturn {
  restartMiner: (minerIp: string) => Promise<void>;
  switchPool: (minerIp: string, target: string) => Promise<void>;
  isExecuting: boolean;
  error: string | null;
}

export const useMinerAction = (): UseMinerActionReturn => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restartMiner = async (minerIp: string) => {
    setIsExecuting(true);
    setError(null);
    try {
      await axios.post(`/api/miners/${minerIp}/restart`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to restart miner";
      setError(msg);
    } finally {
      setIsExecuting(false);
    }
  };

  const switchPool = async (minerIp: string, target: string) => {
    setIsExecuting(true);
    setError(null);
    try {
      await axios.put(`/api/miners/pool/${target}/enable`, null, {
        params: { miner: minerIp },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to switch pool");
    } finally {
      setIsExecuting(false);
    }
  };

  return { restartMiner, switchPool, isExecuting, error };
};
