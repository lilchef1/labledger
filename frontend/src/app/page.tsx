"use client";

import Link from "next/link";
import { useBatches } from "@/lib/hooks/use-batches";
import { useDisciplines } from "@/lib/hooks/use-disciplines";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUp, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const { data: batches, isLoading: batchesLoading } = useBatches();
  const { data: disciplines } = useDisciplines();

  const disciplineMap = new Map(disciplines?.map(d => [d.id, d.name]) ?? []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Batches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{batches?.length ?? "—"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {batches?.reduce((sum, b) => sum + b.report_count, 0) ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quick Upload</CardTitle>
            <CardDescription>Upload a new spreadsheet</CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link href="/reports" />}>
              <FileUp className="mr-2 h-4 w-4" />
              Go to Reports
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Batches</CardTitle>
          <CardDescription>Latest uploaded spreadsheets and generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          {batchesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !batches?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No batches yet. Upload a spreadsheet to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Discipline</TableHead>
                  <TableHead>Reports</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.slice(0, 10).map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.filename}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {disciplineMap.get(batch.discipline_id) ?? `#${batch.discipline_id}`}
                      </Badge>
                    </TableCell>
                    <TableCell>{batch.report_count}</TableCell>
                    <TableCell>{new Date(batch.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/reports/${batch.id}`} />}>
                        View <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
