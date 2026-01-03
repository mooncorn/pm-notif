import axios from 'axios';
import { TradeNotification } from '../types';

const COLORS = {
  BUY: 0x00ff00,  // Green
  SELL: 0xff0000, // Red
};

export async function sendNotification(
  webhookUrl: string,
  trade: TradeNotification
): Promise<void> {
  // Find the position for the traded market
  const tradedPosition = trade.positions?.find(p => p.conditionId === trade.conditionId);

  // Calculate % sold for partial sells
  let percentSoldStr = '';
  if (trade.side === 'SELL' && tradedPosition && tradedPosition.size > 0) {
    const sharesBeforeSell = trade.shares + tradedPosition.size;
    const percentSold = (trade.shares / sharesBeforeSell) * 100;
    percentSoldStr = ` (${percentSold.toFixed(0)}% of position)`;
  }

  // Build compact description
  const lines: string[] = [];

  // Trade line
  const sideIcon = trade.side === 'BUY' ? '🟢' : '🔴';
  const action = trade.side === 'BUY' ? 'Bought' : 'Sold'
  
  lines.push(`${action} ${formatNumber(trade.shares)} ${trade.outcome.toUpperCase()} @ ${formatCents(trade.price)} = $${formatNumber(trade.amount)}${percentSoldStr}`);
  lines.push('');

  // Check if this SELL closed the position (position no longer exists in API)
  if (trade.side === 'SELL' && !tradedPosition) {
    lines.push(`📍 ${trade.market}\n${trade.outcome.toUpperCase()}: CLOSED`);
  }

  // Position lines - show remaining positions in this event
  if (trade.positions && trade.positions.length > 0) {
    for (const pos of trade.positions) {
      if (pos.size < 0.01) {
        lines.push(`📍 ${pos.title}\n${pos.outcome.toUpperCase()}: CLOSED`);
      } else {
        const pnlStr = calculatePositionPnL(pos);
        lines.push(`📍 ${pos.title}\n${pos.outcome.toUpperCase()}: ${formatNumber(pos.size)} @ ${formatCents(pos.avgPrice)} ($${formatNumber(pos.currentValue)})${pnlStr}`);
      }
    }
  }

  const color = COLORS[trade.side];
  const title = `${sideIcon} ${trade.market}`

  const embed = {
    author: {
      name: trade.traderName,
      url: trade.traderProfileUrl,
    },
    title: title,
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

  const arrow = pnl >= 0 ? '▲' : '▼';
  const sign = pnl >= 0 ? '+' : '-';

  // Skip percentage if initial value is 0 (avgPrice was 0)
  if (initialValue === 0) {
    return ` ${arrow} ${sign}$${formatNumber(Math.abs(pnl))}`;
  }

  const pnlPercent = (pnl / initialValue) * 100;
  return ` ${arrow} ${sign}$${formatNumber(Math.abs(pnl))} (${sign}${Math.abs(pnlPercent).toFixed(1)}%)`;
}

function formatNumber(num: number): string {
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCents(price: number): string {
  const cents = Math.round(price * 100);
  return `${cents}¢`;
}
