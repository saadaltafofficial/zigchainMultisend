import { validateConfig, walletConfig, zigchainConfig, getRecipientsFromCsv, csvFilePath } from './config';
import { WalletService } from './wallet';
import { MultiSendService } from './multisend';
import { BatchProcessor } from './batch-processor';
import { FailedBatchRetrier } from './retry-failed-batches';
import fs from 'fs';
import path from 'path';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    retry: args.includes('--retry'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '400', 10),
    maxRetries: parseInt(args.find(arg => arg.startsWith('--max-retries='))?.split('=')[1] || '3', 10),
    retryDelay: parseInt(args.find(arg => arg.startsWith('--retry-delay='))?.split('=')[1] || '5000', 10),
    specificBatch: args.find(arg => arg.startsWith('--retry-batch='))?.split('=')[1]
  };
}

async function main() {
  try {
    // Parse command line arguments once
    const args = parseArgs();
    
    // Check if we should retry failed batches
    if (args.retry) {
      console.log('Retrying failed batches...');
      const retrier = new FailedBatchRetrier();
      
      if (args.specificBatch) {
        const batchNumber = parseInt(args.specificBatch, 10);
        if (isNaN(batchNumber)) {
          console.error('Invalid batch number');
          process.exit(1);
        }
        
        const success = await retrier.retryBatch(batchNumber, args.maxRetries);
        if (success) {
          console.log(`Successfully retried batch #${batchNumber}`);
          process.exit(0);
        } else {
          console.error(`Failed to retry batch #${batchNumber}`);
          process.exit(1);
        }
      } else {
        const result = await retrier.retryAllBatches(args.maxRetries);
        console.log(`Retry complete: ${result.success} succeeded, ${result.failed} failed`);
        process.exit(result.failed > 0 ? 1 : 0);
      }
      return;
    }
    
    // Validate configuration
    if (!(await validateConfig())) {
      process.exit(1);
    }

    console.log('Zigchain MultiSend');
    console.log('------------------');
    console.log(`Chain ID: ${zigchainConfig.chainId}`);
    console.log(`RPC URL: ${zigchainConfig.rpcUrl}`);
    console.log(`Token Denomination: ${zigchainConfig.denom}`);
    
    // Initialize wallet service
    const walletService = new WalletService(walletConfig, zigchainConfig);
    const senderAddress = await walletService.getAddress();
    console.log(`\nSender Address: ${senderAddress}`);
    
    // Get wallet balance
    const balance = await walletService.getBalance();
    console.log(`Balance: ${balance} ${zigchainConfig.denom}`);
    
    // Load recipients from CSV file
    const recipients = await getRecipientsFromCsv(csvFilePath);
    
    // Verify we have recipients
    if (recipients.length === 0) {
      console.error('Error: No recipients found in CSV file');
      process.exit(1);
    }
    
    // Initialize MultiSend service
    const multiSendService = new MultiSendService(walletService, zigchainConfig);
    
    // Initialize the batch processor with optimized settings
    console.log(`Using batch size: ${args.batchSize}, max retries: ${args.maxRetries}, retry delay: ${args.retryDelay}ms`);
    const batchProcessor = new BatchProcessor(args.batchSize, args.maxRetries, args.retryDelay);
    
    // Calculate total amount
    const totalAmount = recipients.reduce(
      (sum, recipient) => sum + BigInt(recipient.amount),
      BigInt(0)
    );
    
    // Display total number of recipients and total amount
    console.log(`\nTotal recipients: ${recipients.length}`);
    console.log(`Total amount to send: ${totalAmount} ${zigchainConfig.denom}`);
    
    // Process recipients in batches
    console.log(`\nProcessing recipients in batches of ${args.batchSize}...`);
    
    // Execute MultiSend transactions in batches
    const transactionHashes = await batchProcessor.processBatches(
      multiSendService,
      senderAddress,
      recipients,
      zigchainConfig.denom
    );
    
    // Summary of all transactions
    console.log('\n--- Transaction Summary ---');
    console.log(`Total batches processed: ${transactionHashes.length}`);
    console.log(`All transaction hashes saved to: transaction-hashes.txt`);
    console.log('\nMultiSend operations completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);

// Display help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Zigchain MultiSend - Usage:

  npm start -- [options]

Options:
  --batch-size=<number>    Set the number of recipients per batch (default: 400)
  --max-retries=<number>   Maximum retry attempts per batch (default: 3)
  --retry-delay=<number>   Delay in ms between retries (default: 5000)
  --retry                  Retry all failed batches from previous runs
  --retry-batch=<number>   Retry a specific failed batch
  --help, -h               Display this help message

Examples:
  npm start                                Run with default settings
  npm start -- --batch-size=300            Run with 300 recipients per batch
  npm start -- --retry                     Retry all failed batches
  npm start -- --retry-batch=2             Retry only batch #2
`);
  process.exit(0);
}
