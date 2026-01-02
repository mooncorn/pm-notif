import axios from 'axios';
import { TradeNotification } from '../types';

const COLORS = {
  BUY: 0x00ff00,  // Green
  SELL: 0xff0000, // Red
  EXIT: 0xffa500, // Orange for full exits
};

export async function sendNotification(
  webhookUrl: string,
  trade: TradeNotification
): Promise<void> {
  const fillSuffix = trade.fillCount && trade.fillCount > 1 ? ` (${trade.fillCount} fills)` : '';

  // Find the position for the traded market
  const tradedPosition = trade.positions?.find(p => p.conditionId === trade.conditionId);

  // Detect full exit (sold everything for this outcome)
  const isFullExit = trade.side === 'SELL' && tradedPosition?.size === 0;

  // Calculate % sold for partial sells
  let percentSoldStr = '';
  if (trade.side === 'SELL' && tradedPosition && !isFullExit) {
    const sharesBeforeSell = trade.shares + tradedPosition.size;
    const percentSold = (trade.shares / sharesBeforeSell) * 100;
    percentSoldStr = ` (${percentSold.toFixed(0)}% of position)`;
  }

  // Build compact description
  const lines: string[] = [];

  // Trade line
  const sideIcon = trade.side === 'BUY' ? '📈' : '📉';
  lines.push(`${sideIcon} ${formatNumber(trade.shares)} ${trade.outcome.toUpperCase()} @ ${formatCents(trade.price)} = $${formatNumber(trade.amount)}${percentSoldStr}`);

  // Position lines - show all positions in this event
  if (isFullExit) {
    lines.push(`💰 Closed ${trade.outcome.toUpperCase()} position (was ${formatNumber(trade.shares)} shares)`);
    // Still show other positions if they exist
    const otherPositions = trade.positions?.filter(p => p.conditionId !== trade.conditionId && p.size > 0);
    if (otherPositions && otherPositions.length > 0) {
      for (const pos of otherPositions) {
        const pnlStr = calculatePositionPnL(pos);
        lines.push(`📍 ${pos.title} ${pos.outcome.toUpperCase()}: ${formatNumber(pos.size)} @ ${formatCents(pos.avgPrice)} ($${formatNumber(pos.currentValue)})${pnlStr}`);
      }
    }
  } else if (trade.positions && trade.positions.length > 0) {
    for (const pos of trade.positions) {
      if (pos.size > 0) {
        const pnlStr = calculatePositionPnL(pos);
        lines.push(`📍 ${pos.title} ${pos.outcome.toUpperCase()}: ${formatNumber(pos.size)} @ ${formatCents(pos.avgPrice)} ($${formatNumber(pos.currentValue)})${pnlStr}`);
      }
    }
  }

  // Determine color
  const color = isFullExit ? COLORS.EXIT : COLORS[trade.side];

  const embed = {
    author: {
      name: trade.traderName,
      url: trade.traderProfileUrl,
    },
    title: trade.market,
    url: trade.marketUrl,
    description: lines.join('\n'),
    color,
    timestamp: new Date().toISOString(),
  };

  try {
    await axios.post(webhookUrl, {
      embeds: [embed],
    });
  } catch (error) {
    console.error('Failed to send Discord notification:', error);
  }
}

function calculatePositionPnL(position: { size: number; avgPrice: number; currentValue: number }): string {
  if (position.size === 0) {
    return '';
  }

  const initialValue = position.size * position.avgPrice;
  const pnl = position.currentValue - initialValue;
  const pnlPercent = (pnl / initialValue) * 100;

  const arrow = pnl >= 0 ? '▲' : '▼';
  const sign = pnl >= 0 ? '+' : '';

  return ` ${arrow} ${sign}$${formatNumber(Math.abs(pnl))} (${sign}${pnlPercent.toFixed(1)}%)`;
}

function formatNumber(num: number): string {
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCents(price: number): string {
  const cents = Math.round(price * 100);
  return `${cents}¢`;
}
