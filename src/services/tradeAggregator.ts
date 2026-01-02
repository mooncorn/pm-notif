import { TradeNotification } from '../types';
import { sendNotification } from './discord';

const AGGREGATION_WINDOW_MS = 5000; // 5 seconds

interface BufferedTrade {
  trades: TradeNotification[];
  timeout: NodeJS.Timeout;
}

const tradeBuffer = new Map<string, BufferedTrade>();
let webhookUrl: string;

export function initAggregator(url: string): void {
  webhookUrl = url;
}

function getAggregationKey(trade: TradeNotification): string {
  return `${trade.traderAddress}:${trade.conditionId}:${trade.side}`;
}

function aggregateTrades(trades: TradeNotification[]): TradeNotification {
  const totalShares = trades.reduce((sum, t) => sum + t.shares, 0);
  const totalAmount = trades.reduce((sum, t) => sum + t.amount, 0);
  const weightedPrice = totalAmount / totalShares;

  // Use the latest trade's position (most up-to-date)
  const latestTrade = trades[trades.length - 1];

  return {
    ...latestTrade,
    shares: totalShares,
    amount: totalAmount,
    price: weightedPrice,
    fillCount: trades.length,
  };
}

async function flushBuffer(key: string): Promise<void> {
  const buffered = tradeBuffer.get(key);
  if (!buffered) return;

  tradeBuffer.delete(key);

  const aggregated = aggregateTrades(buffered.trades);
  console.log(
    `Aggregated ${buffered.trades.length} fills: ${aggregated.traderName} ${aggregated.side} $${aggregated.amount.toFixed(2)} - ${aggregated.market}`
  );

  await sendNotification(webhookUrl, aggregated);
}

export function bufferTrade(trade: TradeNotification): void {
  const key = getAggregationKey(trade);
  const existing = tradeBuffer.get(key);

  if (existing) {
    // Add to existing buffer
    existing.trades.push(trade);
  } else {
    // Create new buffer with timer
    const timeout = setTimeout(() => flushBuffer(key), AGGREGATION_WINDOW_MS);
    tradeBuffer.set(key, {
      trades: [trade],
      timeout,
    });
  }
}

export async function flushAllBuffers(): Promise<void> {
  const keys = Array.from(tradeBuffer.keys());
  for (const key of keys) {
    const buffered = tradeBuffer.get(key);
    if (buffered) {
      clearTimeout(buffered.timeout);
      await flushBuffer(key);
    }
  }
}
