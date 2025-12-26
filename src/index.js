import { Connection } from '@solana/web3.js';
import readline from 'readline';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { config, validateConfig } from './config.js';
import { getKeypairFromMnemonic, getMaskedPublicKey } from './wallet.js';
import { executeSwap, executeBatchSwaps } from './swap.js';

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input
 * @param {readline.Interface} rl - Readline interface
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User input
 */
function prompt(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim());
    });
  });
}

/**
 * Get wallet balance
 * @param {Connection} connection - Solana connection
 * @param {Keypair} keypair - Wallet keypair
 */
async function printBalance(connection, keypair) {
  const balance = await connection.getBalance(keypair.publicKey);
  const solBalance = balance / 1e9;
  console.log(`💰 SOL Balance: ${solBalance.toFixed(4)} SOL`);
}

/**
 * Main entry point
 */
async function main() {
  console.log('═'.repeat(50));
  console.log('🔄 SEEKER TRADE - Solana USDC/USDT Swap Tool');
  console.log('═'.repeat(50));
  
  // Validate configuration
  const errors = validateConfig();
  if (errors.length > 0) {
    console.error('\n❌ Configuration errors:');
    errors.forEach(err => console.error(`   - ${err}`));
    console.error('\nPlease check your .env file');
    process.exit(1);
  }
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const mode = args[0]?.toUpperCase();
  
  // Initialize wallet
  console.log('\n🔑 Initializing wallet...');
  let keypair;
  try {
    keypair = getKeypairFromMnemonic();
    console.log(`📍 Wallet: ${getMaskedPublicKey(keypair)}`);
  } catch (error) {
    console.error(`❌ Wallet error: ${error.message}`);
    process.exit(1);
  }
  
  // Initialize connection with proxy support
  console.log(`🌐 Connecting to: ${config.rpcUrl}`);
  if (config.proxyUrl) {
    console.log(`🔒 Using proxy: ${config.proxyUrl}`);
  }
  
  const connectionConfig = {
    commitment: 'confirmed',
  };
  
  // Add fetch with proxy if configured
  if (config.proxyUrl) {
    const agent = new HttpsProxyAgent(config.proxyUrl);
    connectionConfig.fetch = (url, options) => {
      return fetch(url, { ...options, agent });
    };
  }
  
  const connection = new Connection(config.rpcUrl, connectionConfig);
  
  // Print balance
  await printBalance(connection, keypair);
  
  // Handle different modes
  if (mode === 'USDC_TO_USDT' || mode === 'USDT_TO_USDC') {
    // Single swap mode
    console.log(`\n📌 Mode: Single ${mode}`);
    console.log(`💰 Amount: ${config.swapAmount}`);
    
    try {
      await executeSwap(keypair, connection, mode);
      console.log('\n🎉 Done!');
    } catch (error) {
      console.error(`\n❌ Swap failed: ${error.message}`);
      process.exit(1);
    }
  } else {
    // Batch mode - interactive
    console.log('\n📌 Mode: Batch (Interactive) - USDC ↔ USDT');
    console.log('─'.repeat(50));
    
    const rl = createReadlineInterface();
    
    try {
      // Ask for number of swaps
      const countInput = await prompt(
        rl,
        `\n🔢 Enter number of swaps (default: ${config.batchCount}, max: 1000): `
      );
      
      let count = parseInt(countInput) || config.batchCount;
      count = Math.min(Math.max(count, 1), 1000); // Clamp between 1 and 1000
      
      // Ask for delay
      const delayInput = await prompt(
        rl,
        `⏱️  Enter delay between swaps in ms (default: ${config.swapDelayMs}, API limit: 100tx/5min): `
      );
      
      const delay = parseInt(delayInput) || config.swapDelayMs;
      
      // Confirm
      const priorityFeeDisplay = config.priorityFeeLamports > 0 
        ? `${config.priorityFeeLamports} lamports` 
        : 'auto';
      
      console.log('\n📋 Configuration:');
      console.log(`   - Target successful swaps: ${count}`);
      console.log(`   - Delay: ${delay}ms`);
      console.log(`   - Amount per swap: ${config.swapAmount} USDC/USDT`);
      console.log(`   - Priority fee: ${priorityFeeDisplay}`);
      console.log(`   - Max retries: ${config.maxRetries}`);
      console.log(`   - Slippage: ${config.slippageBps / 100}%`);
      
      const confirm = await prompt(rl, '\n🚀 Start batch swaps? (y/N): ');
      
      if (confirm.toLowerCase() !== 'y') {
        console.log('❌ Cancelled by user');
        rl.close();
        process.exit(0);
      }
      
      rl.close();
      
      // Execute batch swaps
      await executeBatchSwaps(keypair, connection, count, delay);
      
      // Print final balance
      console.log('\n📊 Final balance:');
      await printBalance(connection, keypair);
      
      console.log('\n🎉 All done!');
    } catch (error) {
      rl.close();
      console.error(`\n❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run main
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
