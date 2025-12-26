import {
  Connection,
  VersionedTransaction,
} from '@solana/web3.js';
import { config, TOKENS, DECIMALS } from './config.js';
import {
  getQuote,
  getSwapTransaction,
  getSwapAmountInSmallestUnits,
  formatAmount,
} from './jupiter.js';

/**
 * Execute a single swap
 * @param {Keypair} keypair - Wallet keypair
 * @param {Connection} connection - Solana connection
 * @param {string} direction - 'USDC_TO_USDT' or 'USDT_TO_USDC'
 * @returns {Promise<Object>} Swap result
 */
export async function executeSwap(keypair, connection, direction) {
  const startTime = Date.now();
  
  // Get balance before swap for gas calculation (optional, don't fail if it errors)
  let balanceBefore = null;
  try {
    balanceBefore = await connection.getBalance(keypair.publicKey);
  } catch (e) {
    // Ignore balance fetch error, gas calculation will be skipped
  }
  
  // Determine input/output tokens
  const isUsdcToUsdt = direction === 'USDC_TO_USDT';
  const inputToken = isUsdcToUsdt ? 'USDC' : 'USDT';
  const outputToken = isUsdcToUsdt ? 'USDT' : 'USDC';
  const inputMint = TOKENS[inputToken];
  const outputMint = TOKENS[outputToken];
  
  // Get fixed swap amount
  const inputAmount = getSwapAmountInSmallestUnits(inputToken);
  
  console.log(`\n📊 Getting quote: ${formatAmount(inputAmount, inputToken)} → ${outputToken}`);
  
  // Get quote
  const quote = await getQuote(inputMint, outputMint, inputAmount);
  const expectedOutput = parseInt(quote.outAmount);
  
  console.log(`💱 Expected output: ${formatAmount(expectedOutput, outputToken)}`);
  console.log(`📈 Price impact: ${quote.priceImpactPct}%`);
  
  // Get swap transaction
  console.log('🔄 Building transaction...');
  const swapResponse = await getSwapTransaction(quote, keypair.publicKey.toBase58());
  
  // Deserialize and sign transaction
  const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  
  // Sign with wallet
  transaction.sign([keypair]);
  
  // Send transaction
  console.log('📤 Sending transaction...');
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });
  
  console.log(`🔗 Signature: ${signature}`);
  console.log(`🌐 Explorer: https://solscan.io/tx/${signature}`);
  
  // Confirm transaction
  console.log('⏳ Confirming transaction...');
  let confirmationError = null;
  try {
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err) {
      confirmationError = `Transaction failed: ${JSON.stringify(confirmation.value.err)}`;
    }
  } catch (e) {
    // Network error during confirmation - transaction may still have succeeded
    console.log(`⚠️  Confirmation check failed (tx may still be successful): ${e.message}`);
  }
  
  if (confirmationError) {
    throw new Error(confirmationError);
  }
  
  const duration = Date.now() - startTime;
  
  // Get balance after swap for gas calculation
  let gasUsed = 0;
  try {
    if (balanceBefore !== null) {
      const balanceAfter = await connection.getBalance(keypair.publicKey);
      gasUsed = balanceBefore - balanceAfter;
    const gasUsedSol = gasUsed / 1e9;
    
    // Get SOL price for USD conversion
    let gasDisplay = `⛽ Gas used: ${gasUsedSol.toFixed(6)} SOL`;
    try {
      const solQuote = await getQuote(
        'So11111111111111111111111111111111111111112', // SOL
        TOKENS.USDC,
        1e9 // 1 SOL
      );
      const solPriceUsdc = parseInt(solQuote.outAmount) / 1e6;
      const gasUsdc = gasUsedSol * solPriceUsdc;
      gasDisplay += ` (~$${gasUsdc.toFixed(4)})`;
    } catch (e) {
      // Failed to get price, show without USD
    }
    console.log(gasDisplay);
    } else {
      console.log(`⛽ Gas used: (unable to calculate)`);
    }
  } catch (e) {
    console.log(`⛽ Gas used: (unable to fetch)`);
  }
  
  console.log(`✅ Swap completed in ${duration}ms`);
  
  return {
    signature,
    direction,
    inputAmount,
    inputToken,
    outputAmount: expectedOutput,
    outputToken,
    gasUsed,
    duration,
    success: true,
  };
}

/**
 * Execute batch swaps with alternating directions
 * Target: reach specified number of SUCCESSFUL swaps
 * Failed swaps will be retried
 * @param {Keypair} keypair - Wallet keypair
 * @param {Connection} connection - Solana connection
 * @param {number} targetCount - Target number of successful swaps
 * @param {number} delayMs - Delay between swaps in ms
 * @returns {Promise<Object>} Batch result summary
 */
export async function executeBatchSwaps(keypair, connection, targetCount, delayMs = config.swapDelayMs) {
  const priorityFeeDisplay = config.priorityFeeLamports > 0 
    ? `${config.priorityFeeLamports} lamports` 
    : 'auto';
  
  console.log(`\n🚀 Starting batch targeting ${targetCount} successful swaps (USDC ↔ USDT)...`);
  console.log(`⏱️  Delay between swaps: ${delayMs}ms`);
  console.log(`💰 Amount per swap: ${config.swapAmount} USDC/USDT`);
  console.log(`⛽ Priority fee: ${priorityFeeDisplay}`);
  console.log(`🔄 Max retries per failure: ${config.maxRetries}`);
  console.log('─'.repeat(50));
  
  const results = [];
  let successCount = 0;
  let totalAttempts = 0;
  let totalFailures = 0;
  let directionIndex = 0; // Track direction for alternating
  
  while (successCount < targetCount) {
    // Alternate direction: even = USDC→USDT, odd = USDT→USDC
    const direction = directionIndex % 2 === 0 ? 'USDC_TO_USDT' : 'USDT_TO_USDC';
    
    console.log(`\n[✅ ${successCount}/${targetCount}] Attempt #${totalAttempts + 1} - ${direction}`);
    
    let success = false;
    let lastError = null;
    
    // Try with retries
    for (let retry = 0; retry <= config.maxRetries; retry++) {
      if (retry > 0) {
        console.log(`\n🔄 Retry ${retry}/${config.maxRetries}...`);
        await sleep(delayMs); // Wait before retry
      }
      
      try {
        const result = await executeSwap(keypair, connection, direction);
        results.push(result);
        successCount++;
        directionIndex++; // Move to next direction only on success
        success = true;
        break;
      } catch (error) {
        lastError = error.message;
        console.error(`❌ Swap failed: ${error.message}`);
      }
      
      totalAttempts++;
    }
    
    if (!success) {
      totalFailures++;
      results.push({
        direction,
        success: false,
        error: lastError,
      });
      // Still move to next direction after max retries exhausted
      directionIndex++;
      console.log(`⚠️  Moving to next swap after ${config.maxRetries} failed retries`);
    }
    
    totalAttempts++;
    
    // Wait before next swap (if not done yet)
    if (successCount < targetCount) {
      console.log(`\n⏳ Waiting ${delayMs}ms before next swap...`);
      await sleep(delayMs);
    }
  }
  
  // Calculate total gas used
  const totalGasUsed = results
    .filter(r => r.success && r.gasUsed)
    .reduce((sum, r) => sum + r.gasUsed, 0);
  const totalGasSol = totalGasUsed / 1e9;
  
  // Get SOL price in USDC
  let solPriceUsdc = null;
  try {
    const { getQuote } = await import('./jupiter.js');
    const quote = await getQuote(
      'So11111111111111111111111111111111111111112', // SOL
      TOKENS.USDC,
      1e9 // 1 SOL in lamports
    );
    solPriceUsdc = parseInt(quote.outAmount) / 1e6;
  } catch (e) {
    // Failed to get price
  }
  
  // Print summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 BATCH SUMMARY');
  console.log('═'.repeat(50));
  console.log(`🎯 Target swaps: ${targetCount}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed (after retries): ${totalFailures}`);
  console.log(`📈 Total attempts: ${totalAttempts}`);
  
  if (solPriceUsdc) {
    const totalGasUsdc = totalGasSol * solPriceUsdc;
    console.log(`⛽ Total gas used: ${totalGasSol.toFixed(6)} SOL (~$${totalGasUsdc.toFixed(4)})`);
    if (successCount > 0) {
      const avgGasSol = totalGasSol / successCount;
      const avgGasUsdc = totalGasUsdc / successCount;
      console.log(`⛽ Avg gas per swap: ${avgGasSol.toFixed(6)} SOL (~$${avgGasUsdc.toFixed(4)})`);
    }
  } else {
    console.log(`⛽ Total gas used: ${totalGasSol.toFixed(6)} SOL`);
    if (successCount > 0) {
      console.log(`⛽ Avg gas per swap: ${(totalGasSol / successCount).toFixed(6)} SOL`);
    }
  }
  
  return {
    total: count,
    successful: successCount,
    failed: failCount,
    totalGasUsed,
    results,
  };
}

/**
 * Sleep helper
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
