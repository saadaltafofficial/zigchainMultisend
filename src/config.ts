import dotenv from 'dotenv';
import { ZigchainConfig, WalletConfig, Recipient } from './types';
import path from 'path';
import { readRecipientsFromCsv, getDefaultCsvPath } from './csv-reader';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Parse recipients from environment variable (legacy method)
export const parseRecipients = (recipientsString: string): Recipient[] => {
  if (!recipientsString) return [];
  
  return recipientsString.split(';').map(pair => {
    const [address, amount] = pair.split(',');
    return {
      address: address.trim(),
      amount: amount.trim()
    };
  });
};

// Get recipients from CSV file
export const getRecipientsFromCsv = async (csvPath?: string): Promise<Recipient[]> => {
  try {
    const filePath = csvPath || getDefaultCsvPath();
    console.log(`Reading recipients from CSV file: ${filePath}`);
    return await readRecipientsFromCsv(filePath);
  } catch (error) {
    console.error('Error reading recipients from CSV:', error);
    throw error;
  }
};

// Zigchain configuration
export const zigchainConfig: ZigchainConfig = {
  rpcUrl: process.env.ZIGCHAIN_RPC_URL || 'https://testnet-api.zigchain.com/',
  chainId: process.env.ZIGCHAIN_CHAIN_ID || 'zigchain-testnet',
  denom: process.env.DENOM || 'uzig'
};

// Wallet configuration
export const walletConfig: WalletConfig = {
  mnemonic: process.env.MNEMONIC,
  privateKey: process.env.PRIVATE_KEY,
  prefix: 'zig' // Zigchain address prefix
};

// CSV file path (can be overridden by environment variable)
export const csvFilePath = process.env.CSV_FILE_PATH || getDefaultCsvPath();

// Validate configuration
export const validateConfig = async (): Promise<boolean> => {
  if (!walletConfig.mnemonic && !walletConfig.privateKey) {
    console.error('Error: Either MNEMONIC or PRIVATE_KEY is required in .env file');
    return false;
  }

  try {
    // We don't validate recipients here anymore since they're loaded asynchronously from CSV
    return true;
  } catch (error) {
    console.error('Configuration validation failed:', error);
    return false;
  }
};
