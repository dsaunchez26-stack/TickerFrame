import { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useStockDetail } from '@/context/StockDetailContext';

// Reuses the same StockDetailModal every ticker click elsewhere in the app
// already opens -- works for any valid ticker, not just the tracked
// universe (see StockDetailModal's live-quote fallback).
export const StockSearchBar = () => {
  const { open } = useStockDetail();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const symbol = value.trim().toUpperCase();
    if (!symbol) return;
    // The modal's Dialog is opened imperatively here (via context state),
    // not through its own DialogTrigger -- if keyboard focus is still
    // sitting on this input when it mounts, Radix's dismiss-on-outside-
    // interaction logic sees focus outside the just-opened dialog and
    // closes it almost immediately (looks like it "flashes and vanishes").
    // Blurring first means focus is nowhere by the time the dialog mounts.
    inputRef.current?.blur();
    open(symbol);
    setValue('');
  };

  return (
    <div className="relative w-full max-w-[180px] sm:max-w-[220px]">
      <button
        type="button"
        onClick={submit}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label="Search"
      >
        <Search className="h-3.5 w-3.5" />
      </button>
      <Input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value.toUpperCase())}
        // e.key alone has been observed to come through empty/unset for
        // this exact keypress in at least one real environment (confirmed
        // via a direct listener: key/code/keyCode/which all blank on a
        // trusted, correctly-targeted keydown) -- keyCode 13 as a fallback
        // catches Enter even when the browser/input method doesn't
        // populate .key the normal way.
        onKeyDown={e => (e.key === 'Enter' || e.keyCode === 13) && submit()}
        placeholder="Look up a ticker…"
        autoComplete="off"
        className="h-8 pl-8 text-xs"
      />
    </div>
  );
};
