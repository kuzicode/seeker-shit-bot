import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { config } from './config.js';

/**
 * Derive Solana keypair from mnemonic using standard derivation path
 * @returns {Keypair} Solana keypair
 */
export function getKeypairFromMnemonic() {
  const mnemonic = config.mnemonic.trim();
  
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }
  
  // Convert mnemonic to seed
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  
  // Use Solana's standard derivation path (Phantom, Solflare, etc.)
  const derivationPath = "m/44'/501'/0'/0'";
  const derivedSeed = derivePath(derivationPath, seed.toString('hex')).key;
  
  return Keypair.fromSeed(derivedSeed);
}

/**
 * Get wallet public key (masked for logging)
 * @param {Keypair} keypair 
 * @returns {string} Masked public key
 */
export function getMaskedPublicKey(keypair) {
  const pubkey = keypair.publicKey.toBase58();
  return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
}

