import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Trader } from '../types';

dotenv.config();

export interface Config {
  discordWebhookUrl: string;
  pollIntervalMs: number;
  traders: Trader[];
}

function loadTraders(): Trader[] {
  const tradersPath = path.join(process.cwd(), 'config', 'traders.json');

  if (!fs.existsSync(tradersPath)) {
    throw new Error(`Traders config not found at ${tradersPath}`);
  }

  const content = fs.readFileSync(tradersPath, 'utf-8');
  const traders: Trader[] = JSON.parse(content);

  if (!Array.isArray(traders) || traders.length === 0) {
    throw new Error('Traders config must be a non-empty array');
  }

  for (const trader of traders) {
    if (!trader.address || !trader.name) {
      throw new Error('Each trader must have "address" and "name" fields');
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(trader.address)) {
      throw new Error(`Invalid Ethereum address: ${trader.address}`);
    }
  }

  return traders;
}

export function loadConfig(): Config {
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!discordWebhookUrl) {
    throw new Error('DISCORD_WEBHOOK_URL environment variable is required');
  }

  const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS || '1000', 10);
  if (isNaN(pollIntervalMs) || pollIntervalMs < 100) {
    throw new Error('POLL_INTERVAL_MS must be at least 100ms');
  }

  const traders = loadTraders();

  return {
    discordWebhookUrl,
    pollIntervalMs,
    traders,
  };
}
