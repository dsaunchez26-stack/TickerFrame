import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NewsList } from '@/components/NewsList';

export const NewsFeed = () => (
  <Card>
    <CardHeader><CardTitle className="text-sm font-semibold">Market Headlines</CardTitle></CardHeader>
    <CardContent>
      <NewsList limit={10} />
    </CardContent>
  </Card>
);
