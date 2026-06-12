import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ColumnMappingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Column Mapping</h1>
      <Card>
        <CardHeader>
          <CardTitle>Saved Mappings</CardTitle>
          <CardDescription>Manage saved spreadsheet column mappings</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
