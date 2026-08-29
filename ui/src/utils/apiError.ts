// src/utils/apiError.ts
import axios from "axios";

// Pulls the server's own message out of an ErrorResponse body (see
// handler.ErrorResponse server-side: {error, message, code}) when present,
// falling back to whatever axios/JS gives us otherwise.
export const extractErrorMessage = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message ?? err.message;
  }
  return err instanceof Error ? err.message : "Request failed";
};
