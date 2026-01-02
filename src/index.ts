import { loadConfig } from './config/env';
import { initDatabase, closeDatabase } from './db/sqlite';
import { startMonitor, stopMonitor } from './services/tradeMonitor';
import { flushAllBuffers } from './services/tradeAggregator';

async function main(): Promise<void> {
  console.log('Polymarket Notification System');
  console.log('==============================\n');

  const config = loadConfig();
  console.log(`Loaded ${config.traders.length} trader(s) to monitor`);

  initDatabase();

  const shutdown = async (): Promise<void> => {
    console.log('\nShutting down...');
    stopMonitor();
    console.log('Flushing pending notifications...');
    await flushAllBuffers();
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await startMonitor(config.traders, config.discordWebhookUrl, config.pollIntervalMs);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
