"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDisciplines } from "@/lib/hooks/use-admin";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe } from "lucide-react";

interface ScopeSelectorProps {
  onChange?: (scope: string) => void;
}

export function ScopeSelector({ onChange }: ScopeSelectorProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: disciplines } = useDisciplines();

  const currentScope = searchParams.get("scope") || "global";

  function handleScopeChange(scope: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("scope", scope);
    router.push(`${pathname}?${params.toString()}`);
    onChange?.(scope);
  }

  return (
    <Tabs value={currentScope} onValueChange={handleScopeChange}>
      <TabsList>
        <TabsTrigger value="global">
          <Globe className="h-4 w-4 mr-1" />
          All Disciplines
        </TabsTrigger>
        {disciplines?.map((disc) => (
          <TabsTrigger key={disc.id} value={String(disc.id)}>
            {disc.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
