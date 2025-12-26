import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// Token addresses on Solana mainnet
export const TOKENS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
};

// Token decimals
export const DECIMALS = {
  USDC: 6,
  USDT: 6,
};

// Configuration
export const config = {
  // Mnemonic (support both SOLANA_MNEMONIC and MNEMONIC)
  mnemonic: process.env.SOLANA_MNEMONIC || process.env.MNEMONIC || '',
  
  // Jupiter API (new endpoint: api.jup.ag)
  jupApiKey: process.env.JUP_API_KEY || '',
  jupApiUrl: 'https://api.jup.ag/swap/v1',
  
  // Solana RPC
  rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
  
  // Proxy (optional)
  proxyUrl: process.env.PROXY_URL || '',
  
  // Swap settings
  swapAmount: parseFloat(process.env.SWAP_AMOUNT) || 0.001, // Fixed amount per swap
  swapDelayMs: parseInt(process.env.SWAP_DELAY_MS) || 3000, // 3s delay to respect API rate limit (100 tx / 5min)
  slippageBps: parseInt(process.env.SLIPPAGE_BPS) || 50, // 0.5%
  
  // Priority fee settings (in lamports, 0 = auto)
  // Low fee: 1000-10000, Medium: 10000-50000, High: 50000+
  priorityFeeLamports: parseInt(process.env.PRIORITY_FEE) || 1000, // Default: 1000 lamports (low)
  
  // Batch settings
  batchCount: parseInt(process.env.BATCH_COUNT) || 200, // Total successful swaps target
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3, // Max retries per failed swap
};

// Validate configuration
export function validateConfig() {
  const errors = [];
  
  if (!config.mnemonic) {
    errors.push('Missing SOLANA_MNEMONIC or MNEMONIC in .env');
  }
  
  if (!config.jupApiKey) {
    errors.push('Missing JUP_API_KEY in .env');
  }
  
  if (config.swapAmount <= 0) {
    errors.push('SWAP_AMOUNT must be positive');
  }
  
  return errors;
}

