import useSWR from "swr";
import { apiGet } from "@/lib/api";
import type { Discipline } from "@/lib/types";

export function useDisciplines() {
  return useSWR<Discipline[]>("/api/reports/disciplines", apiGet);
}
