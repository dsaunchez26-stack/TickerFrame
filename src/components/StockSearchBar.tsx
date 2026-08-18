import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useStockDetail } from '@/context/StockDetailContext';

// Reuses the same StockDetailModal every ticker click elsewhere in the app
// already opens -- works for any valid ticker, not just the tracked
// universe (see StockDetailModal's live-quote fallback).
export const StockSearchBar = () => {
  const { open } = useStockDetail();
  const [value, setValue] = useState('');

  const submit = () => {
    const symbol = value.trim().toUpperCase();
    if (!symbol) return;
    open(symbol);
    setValue('');
  };

  return (
    <div className="relative w-full max-w-[180px] sm:max-w-[220px]">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={e => setValue(e.target.value.toUpperCase())}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Look up a ticker…"
        className="h-8 pl-8 text-xs"
      />
    </div>
  );
};
