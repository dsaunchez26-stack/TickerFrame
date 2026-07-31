import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Newspaper } from 'lucide-react';

export const NewsFeed = () => (
  <Card>
    <CardHeader><CardTitle className="text-sm font-semibold">Breaking News</CardTitle></CardHeader>
    <CardContent>
      <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-muted-foreground">
        <Newspaper className="h-6 w-6" />
        <p>Live news feed isn't connected yet — this needs a news-fetching edge function wired to a real provider.</p>
      </div>
    </CardContent>
  </Card>
);
