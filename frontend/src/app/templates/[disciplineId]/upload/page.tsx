import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UploadTemplatePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Upload Template</h1>
      <Card>
        <CardHeader>
          <CardTitle>Template Upload</CardTitle>
          <CardDescription>Upload an Excel, Word, or HTML template</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
