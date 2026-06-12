import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TemplateSectionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Template Sections</h1>
      <Card>
        <CardHeader>
          <CardTitle>Section Management</CardTitle>
          <CardDescription>Define and reorder template sections</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
