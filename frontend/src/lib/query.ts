import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry permanent client errors (401/403/404/410/422) — surface them
      // immediately instead of showing loading skeletons through pointless retries.
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (typeof status === "number" && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});
