import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const KonvaCanvas = dynamic(() => import('../components/KonvaCanvas'), {
  ssr: false,
});

export default function TestKonvaPage() {
  const imageUrl = "/test.jpg";

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">React Konva Rectangle Drawing</h1>
      <Card className="max-w-[500px] mx-auto overflow-hidden">
        <CardHeader>
          <CardTitle>Drawing Canvas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-full max-h-[70vh] overflow-auto">
            <KonvaCanvas imageUrl={imageUrl} />
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" className="mr-2">Clear</Button>
            <Button>Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
