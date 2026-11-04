import { useUniverse } from '@/hooks/useUniverse';

export const UniverseToggle = () => {
  const { universe, setUniverse } = useUniverse();
  const btn = (value: 'top50' | 'all', label: string) => (
    <button
      onClick={() => setUniverse(value)}
      className={`rounded-sm px-2 py-0.5 transition-colors ${universe === value ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5 text-[11px]" title="Which stocks the lists on this page cover">
      {btn('top50', 'Top 50')}
      {btn('all', 'All stocks')}
    </div>
  );
};
