import useSWR from "swr";
import { apiGet } from "@/lib/api";
import type { BatchSummary, BatchDetail } from "@/lib/types";

export function useBatches() {
  return useSWR<BatchSummary[]>("/api/reports/batches", apiGet);
}

export function useBatch(batchId: string | null) {
  return useSWR<BatchDetail>(
    batchId ? `/api/reports/batch/${batchId}` : null,
    apiGet
  );
}
