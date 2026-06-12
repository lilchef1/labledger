import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DesignerPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Template Designer</h1>
        <Badge variant="secondary">Phase 2</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Visual Template Builder</CardTitle>
          <CardDescription>Create report layouts from scratch with a grid-based drag-and-drop designer. Define page size, format cells, assign data mappings, and import logos.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">This feature is planned for Phase 2 development.</p>
        </CardContent>
      </Card>
    </div>
  );
}
