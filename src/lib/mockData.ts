export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  signal: 'buy' | 'sell' | 'hold';
  entry: number;
  exit: number;
  rsi: number;
  macd: number;
  sma20: number;
  ema9: number;
  holdDuration?: string;
  prevClose?: number;
  lastUpdated?: string;
  pattern?: string | null;
  patternConfidence?: number;
}

export interface ChartPoint {
  time: string;
  price: number;
  volume: number;
  sma20: number;
  ema9: number;
}

export const generateStocks = (): Stock[] => [
  { symbol: 'AAPL', name: 'MicroApps Inc', price: 0.47, change: 0.08, changePercent: 20.51, volume: 12400000, signal: 'buy', entry: 0.42, exit: 0.58, rsi: 68, macd: 0.012, sma20: 0.41, ema9: 0.44 },
  { symbol: 'NVDX', name: 'NovaDex Bio', price: 1.23, change: -0.15, changePercent: -10.87, volume: 8700000, signal: 'sell', entry: 1.10, exit: 1.45, rsi: 28, macd: -0.034, sma20: 1.35, ema9: 1.28 },
  { symbol: 'SPCX', name: 'SpaceCorp X', price: 0.89, change: 0.02, changePercent: 2.30, volume: 5600000, signal: 'hold', entry: 0.82, exit: 1.05, rsi: 52, macd: 0.003, sma20: 0.86, ema9: 0.88 },
  { symbol: 'GRWV', name: 'GreenWave Tech', price: 0.31, change: 0.11, changePercent: 55.00, volume: 34200000, signal: 'buy', entry: 0.25, exit: 0.45, rsi: 78, macd: 0.045, sma20: 0.22, ema9: 0.28 },
  { symbol: 'QLNK', name: 'QuantumLink AI', price: 2.15, change: -0.42, changePercent: -16.34, volume: 19800000, signal: 'sell', entry: 1.90, exit: 2.60, rsi: 22, macd: -0.067, sma20: 2.45, ema9: 2.30 },
  { symbol: 'FLXM', name: 'FlexiMed Corp', price: 0.67, change: 0.03, changePercent: 4.69, volume: 3100000, signal: 'hold', entry: 0.60, exit: 0.80, rsi: 55, macd: 0.008, sma20: 0.63, ema9: 0.65 },
  { symbol: 'ZROX', name: 'ZeroX Energy', price: 0.14, change: 0.06, changePercent: 75.00, volume: 89000000, signal: 'buy', entry: 0.10, exit: 0.22, rsi: 82, macd: 0.021, sma20: 0.09, ema9: 0.12 },
  { symbol: 'DRKM', name: 'DarkMatter Inc', price: 3.42, change: -0.08, changePercent: -2.29, volume: 2400000, signal: 'hold', entry: 3.20, exit: 3.80, rsi: 48, macd: -0.005, sma20: 3.38, ema9: 3.40 },
];

export const generateChartData = (): ChartPoint[] => {
  const data: ChartPoint[] = [];
  let price = 0.35;
  for (let i = 0; i < 60; i++) {
    const delta = (Math.random() - 0.48) * 0.04;
    price = Math.max(0.05, price + delta);
    data.push({
      time: `${9 + Math.floor(i / 4)}:${String((i % 4) * 15).padStart(2, '0')}`,
      price: Math.round(price * 1000) / 1000,
      volume: Math.round(Math.random() * 5000000),
      sma20: Math.round((price - 0.02 + Math.random() * 0.01) * 1000) / 1000,
      ema9: Math.round((price + 0.005 + Math.random() * 0.01) * 1000) / 1000,
    });
  }
  return data;
};
