import axios from 'axios';
import { Trader, PolymarketActivity, PolymarketPosition, TradeNotification } from '../types';
import { isProcessed, markProcessed } from '../db/sqlite';
import { bufferTrade, initAggregator } from './tradeAggregator';

const POLYMARKET_API = 'https://data-api.polymarket.com';

let isRunning = false;

async function fetchTraderActivity(address: string): Promise<PolymarketActivity[]> {
  try {
    const response = await axios.get<PolymarketActivity[]>(
      `${POLYMARKET_API}/activity`,
      {
        params: {
          user: address,
          type: 'TRADE',
        },
        timeout: 10000,
      }
    );
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch activity for ${address}:`, error);
    return [];
  }
}

async function fetchTraderPositions(address: string): Promise<PolymarketPosition[]> {
  const allPositions: PolymarketPosition[] = [];
  const limit = 100;
  let offset = 0;

  try {
    while (true) {
      const response = await axios.get<PolymarketPosition[]>(
        `${POLYMARKET_API}/positions`,
        {
          params: { user: address, limit, offset },
          timeout: 10000,
        }
      );

      const batch = response.data;
      allPositions.push(...batch);

      if (batch.length < limit) break; // No more pages
      offset += limit;
    }
    return allPositions;
  } catch (error) {
    console.error(`Failed to fetch positions for ${address}:`, error);
    return [];
  }
}

function activityToNotification(
  activity: PolymarketActivity,
  trader: Trader,
  eventPositions: PolymarketPosition[]
): TradeNotification {
  const amount = parseFloat(activity.usdcSize);
  const price = parseFloat(activity.price);
  const shares = parseFloat(activity.size);

  return {
    traderName: trader.name,
    traderAddress: trader.address,
    traderProfileUrl: `https://polymarket.com/@${trader.name}`,
    side: activity.side,
    shares,
    amount,
    price,
    market: activity.title,
    marketUrl: `https://polymarket.com/event/${activity.eventSlug}`,
    outcome: activity.outcome,
    conditionId: activity.conditionId,
    transactionHash: activity.transactionHash,
    positions: eventPositions.length > 0 ? eventPositions.map(p => ({
      outcome: p.outcome,
      size: p.size,
      avgPrice: p.avgPrice,
      currentValue: p.currentValue,
      conditionId: p.conditionId,
      title: p.title,
    })) : undefined,
  };
}

export async function startMonitor(
  traders: Trader[],
  webhookUrl: string,
  pollIntervalMs: number
): Promise<void> {
  isRunning = true;
  initAggregator(webhookUrl);
  console.log(`Starting monitor for ${traders.length} trader(s)`);
  console.log(`Poll interval: ${pollIntervalMs}ms`);
  console.log(`Aggregation window: 5 seconds`);

  while (isRunning) {
    for (const trader of traders) {
      const activities = await fetchTraderActivity(trader.address);

      const newActivities = activities.filter(a => !isProcessed(a.transactionHash));
      if (newActivities.length === 0) continue;

      const positions = await fetchTraderPositions(trader.address);

      for (const activity of newActivities) {
        const eventPositions = positions.filter(p => p.eventSlug === activity.eventSlug);

        const notification = activityToNotification(activity, trader, eventPositions);
        console.log(
          `New fill: ${trader.name} ${activity.side} $${notification.amount.toFixed(2)} - ${activity.title}`
        );

        bufferTrade(notification);
        markProcessed(activity.transactionHash);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

export function stopMonitor(): void {
  isRunning = false;
  console.log('Monitor stopped');
}
