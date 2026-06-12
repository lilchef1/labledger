import useSWR from "swr";
import { apiGet } from "@/lib/api";
import type { ReportDetail } from "@/lib/types";

export function useReport(batchId: string | null, labId: string | null) {
  return useSWR<ReportDetail>(
    batchId && labId ? `/api/reports/batch/${batchId}/${labId}` : null,
    apiGet
  );
}
