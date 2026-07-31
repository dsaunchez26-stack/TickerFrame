import { useStockData } from '@/hooks/useStockData';

export const TickerBanner = () => {
  const { data } = useStockData();
  const items = data?.stocks ?? [];

  if (!items.length) return null;

  return (
    <div className="overflow-x-auto border-b border-border bg-card/30 py-1.5">
      <div className="flex w-max gap-6 whitespace-nowrap px-4 text-[11px]">
        {items.map((s) => (
          <span key={s.symbol} className="flex items-center gap-1">
            <span className="font-semibold">{s.symbol}</span>
            <span className={s.change >= 0 ? 'text-signal-buy' : 'text-signal-sell'}>${s.price.toFixed(2)}</span>
          </span>
        ))}
      </div>
    </div>
  );
};
