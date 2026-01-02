export interface Trader {
  address: string;
  name: string;
}

export interface PolymarketActivity {
  id: string;
  type: string;
  side: 'BUY' | 'SELL';
  size: string;
  usdcSize: string;
  price: string;
  asset: string;
  conditionId: string;
  title: string;
  slug: string;
  eventSlug: string;
  outcome: string;
  transactionHash: string;
  timestamp: string;
  createdAt: string;
}

export interface PolymarketPosition {
  conditionId: string;
  eventSlug: string;
  title: string;
  size: number;
  avgPrice: number;
  currentValue: number;
  outcome: string;
}

export interface TradeNotification {
  traderName: string;
  traderAddress: string;
  traderProfileUrl: string;
  side: 'BUY' | 'SELL';
  shares: number;
  amount: number;
  price: number;
  market: string;
  marketUrl: string;
  outcome: string;
  conditionId: string;
  transactionHash: string;
  fillCount?: number;
  positions?: {
    outcome: string;
    size: number;
    avgPrice: number;
    currentValue: number;
    conditionId: string;
    title: string;
  }[];
}
