import { createContext, useContext, useState, ReactNode } from 'react';
import { StockDetailModal } from '@/components/StockDetailModal';

interface Ctx { open: (symbol: string) => void; }
const StockDetailContext = createContext<Ctx>({ open: () => {} });

export const useStockDetail = () => useContext(StockDetailContext);

export const StockDetailProvider = ({ children }: { children: ReactNode }) => {
  const [symbol, setSymbol] = useState<string | null>(null);
  return (
    <StockDetailContext.Provider value={{ open: setSymbol }}>
      {children}
      <StockDetailModal symbol={symbol} onClose={() => setSymbol(null)} />
    </StockDetailContext.Provider>
  );
};
