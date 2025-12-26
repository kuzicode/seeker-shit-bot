import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { config, TOKENS, DECIMALS } from './config.js';

/**
 * Create fetch options with optional proxy
 * @returns {Object} Fetch options
 */
function getFetchOptions() {
  const options = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (config.jupApiKey) {
    options.headers['x-api-key'] = config.jupApiKey;
  }
  
  if (config.proxyUrl) {
    options.agent = new HttpsProxyAgent(config.proxyUrl);
  }
  
  return options;
}

/**
 * Get quote from Jupiter API
 * @param {string} inputMint - Input token mint address
 * @param {string} outputMint - Output token mint address
 * @param {number} amount - Amount in smallest units
 * @returns {Promise<Object>} Quote response
 */
export async function getQuote(inputMint, outputMint, amount) {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: config.slippageBps.toString(),
    onlyDirectRoutes: 'false',
    asLegacyTransaction: 'false',
  });
  
  const url = `${config.jupApiUrl}/quote?${params}`;
  const options = getFetchOptions();
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Quote failed: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * Get swap transaction from Jupiter API
 * @param {Object} quoteResponse - Quote response from getQuote
 * @param {string} userPublicKey - User's wallet public key
 * @returns {Promise<Object>} Swap transaction response
 */
export async function getSwapTransaction(quoteResponse, userPublicKey) {
  const url = `${config.jupApiUrl}/swap`;
  const options = getFetchOptions();
  
  // Use fixed priority fee if configured, otherwise auto
  const priorityFee = config.priorityFeeLamports > 0 
    ? config.priorityFeeLamports 
    : 'auto';
  
  const body = {
    quoteResponse,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: priorityFee,
  };
  
  const response = await fetch(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Swap transaction failed: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * Get swap amount in smallest units
 * @param {string} token - Token symbol ('USDC' or 'USDT')
 * @returns {number} Amount in smallest units
 */
export function getSwapAmountInSmallestUnits(token) {
  const decimals = DECIMALS[token];
  return Math.floor(config.swapAmount * Math.pow(10, decimals));
}

/**
 * Format amount for display
 * @param {number} amount - Amount in smallest units
 * @param {string} token - Token symbol ('USDC' or 'USDT')
 * @returns {string} Formatted amount
 */
export function formatAmount(amount, token) {
  const decimals = DECIMALS[token];
  const value = amount / Math.pow(10, decimals);
  return `${value.toFixed(decimals)} ${token}`;
}
