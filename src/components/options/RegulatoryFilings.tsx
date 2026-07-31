import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export const RegulatoryFilings = () => (
  <Card>
    <CardHeader><CardTitle className="text-sm font-semibold">Regulatory Filings</CardTitle></CardHeader>
    <CardContent>
      <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-muted-foreground">
        <FileText className="h-6 w-6" />
        <p>SEC filings feed isn't connected yet — this needs an edge function pulling from EDGAR or a filings API.</p>
      </div>
    </CardContent>
  </Card>
);
