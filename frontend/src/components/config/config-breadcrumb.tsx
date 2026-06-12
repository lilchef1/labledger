"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useDiscipline } from "@/lib/hooks/use-admin";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const SECTION_NAMES: Record<string, string> = {
  analytes: "Analytes",
  columns: "Columns",
  mapping: "Column Mapping",
  "request-codes": "Request Codes",
  "sig-figs": "Sig Figs",
  "custom-blocks": "Custom Blocks",
  computations: "Computed Fields",
  triggers: "Triggers",
  template: "Templates",
};

export function ConfigBreadcrumb({ section }: { section?: string }) {
  const params = useParams<{ disciplineId: string }>();
  const discId = params.disciplineId ? Number(params.disciplineId) : null;
  const { data: disc } = useDiscipline(discId);

  const sectionName = section ? SECTION_NAMES[section] ?? section : undefined;

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          {discId ? (
            <BreadcrumbLink render={<Link href="/config" />}>Config</BreadcrumbLink>
          ) : (
            <BreadcrumbPage>Config</BreadcrumbPage>
          )}
        </BreadcrumbItem>

        {disc && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {sectionName ? (
                <BreadcrumbLink render={<Link href={`/config/${disc.id}`} />}>
                  {disc.name}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{disc.name}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        )}

        {sectionName && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{sectionName}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
