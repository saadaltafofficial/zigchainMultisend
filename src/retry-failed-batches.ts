import fs from 'fs';
import path from 'path';
import { MultiSendService } from './multisend';
import { WalletService } from './wallet';
import { walletConfig, zigchainConfig } from './config';
import { Recipient } from './types';

/**
 * Utility to retry failed batches from previous runs
 */
export class FailedBatchRetrier {
  private failedBatchesPath: string;
  private hashesFilePath: string;
  private multiSendService: MultiSendService;
  
  constructor() {
    this.failedBatchesPath = path.join(process.cwd(), 'failed-batches.json');
    this.hashesFilePath = path.join(process.cwd(), 'transaction-hashes.txt');
    
    // Initialize services
    const walletService = new WalletService(walletConfig, zigchainConfig);
    this.multiSendService = new MultiSendService(walletService, zigchainConfig);
  }
  
  /**
   * Sleep for a specified duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Save a transaction hash to the file
   */
  private saveTransactionHash(batchNumber: number, hash: string, recipientCount: number): void {
    const entry = `Batch #${batchNumber} | ${recipientCount} recipients | Hash: ${hash} | Time: ${new Date().toISOString()} (RETRY)\n`;
    
    fs.appendFileSync(this.hashesFilePath, entry, 'utf8');
    
    console.log(`Transaction hash saved to ${this.hashesFilePath}`);
  }
  
  /**
   * Remove a batch from the failed batches file
   */
  private removeFromFailedBatches(batchNumber: number): void {
    if (!fs.existsSync(this.failedBatchesPath)) {
      return;
    }
    
    try {
      const content = fs.readFileSync(this.failedBatchesPath, 'utf8');
      const failedBatches = JSON.parse(content);
      
      const updatedBatches = failedBatches.filter((batch: any) => batch.batchNumber !== batchNumber);
      
      fs.writeFileSync(this.failedBatchesPath, JSON.stringify(updatedBatches, null, 2), 'utf8');
      console.log(`Removed batch #${batchNumber} from failed batches file`);
    } catch (error) {
      console.error('Error removing batch from failed batches file:', error);
    }
  }
  
  /**
   * Get all failed batches
   */
  getFailedBatches(): Array<{batchNumber: number, recipients: Recipient[], error: string}> {
    if (!fs.existsSync(this.failedBatchesPath)) {
      console.log('No failed batches file found');
      return [];
    }
    
    try {
      const content = fs.readFileSync(this.failedBatchesPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading failed batches:', error);
      return [];
    }
  }
  
  /**
   * Retry a specific failed batch
   */
  async retryBatch(batchNumber: number, maxRetries: number = 3): Promise<boolean> {
    const failedBatches = this.getFailedBatches();
    const batchToRetry = failedBatches.find(batch => batch.batchNumber === batchNumber);
    
    if (!batchToRetry) {
      console.error(`Batch #${batchNumber} not found in failed batches`);
      return false;
    }
    
    console.log(`\n--- Retrying Batch #${batchNumber} (${batchToRetry.recipients.length} recipients) ---`);
    console.log(`Original error: ${batchToRetry.error}`);
    
    let success = false;
    let retryCount = 0;
    
    while (retryCount < maxRetries && !success) {
      try {
        console.log(`Retry attempt ${retryCount + 1}/${maxRetries}...`);
        
        // Execute the MultiSend transaction
        const hash = await this.multiSendService.executeMultiSend(batchToRetry.recipients);
        
        console.log(`\nBatch #${batchNumber} retry successful!`);
        console.log(`Transaction hash: ${hash}`);
        console.log(`You can view the transaction at: https://explorer.zigchain.com/tx/${hash}`);
        
        // Save the hash to the file
        this.saveTransactionHash(batchNumber, hash, batchToRetry.recipients.length);
        
        // Remove from failed batches
        this.removeFromFailedBatches(batchNumber);
        
        success = true;
      } catch (error) {
        console.error(`Error on retry attempt ${retryCount + 1}:`, error);
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`Waiting 10 seconds before next retry attempt...`);
          await this.sleep(10000);
        }
      }
    }
    
    return success;
  }
  
  /**
   * Retry all failed batches
   */
  async retryAllBatches(maxRetries: number = 3): Promise<{success: number, failed: number}> {
    const failedBatches = this.getFailedBatches();
    
    if (failedBatches.length === 0) {
      console.log('No failed batches to retry');
      return { success: 0, failed: 0 };
    }
    
    console.log(`Found ${failedBatches.length} failed batches to retry`);
    
    let successCount = 0;
    let failedCount = 0;
    
    for (const batch of failedBatches) {
      const result = await this.retryBatch(batch.batchNumber, maxRetries);
      
      if (result) {
        successCount++;
      } else {
        failedCount++;
      }
      
      // Wait between batches
      if (batch !== failedBatches[failedBatches.length - 1]) {
        console.log('Waiting 5 seconds before next batch retry...');
        await this.sleep(5000);
      }
    }
    
    console.log(`\nRetry summary: ${successCount} succeeded, ${failedCount} failed`);
    return { success: successCount, failed: failedCount };
  }
}

// CLI handler for retrying failed batches
if (require.main === module) {
  const retrier = new FailedBatchRetrier();
  
  // Check if a specific batch number was provided
  const args = process.argv.slice(2);
  const batchArg = args.find(arg => arg.startsWith('--batch='));
  
  if (batchArg) {
    const batchNumber = parseInt(batchArg.split('=')[1], 10);
    
    if (isNaN(batchNumber)) {
      console.error('Invalid batch number');
      process.exit(1);
    }
    
    console.log(`Retrying batch #${batchNumber}...`);
    retrier.retryBatch(batchNumber)
      .then(success => {
        if (success) {
          console.log(`Successfully retried batch #${batchNumber}`);
          process.exit(0);
        } else {
          console.error(`Failed to retry batch #${batchNumber}`);
          process.exit(1);
        }
      })
      .catch(error => {
        console.error('Error retrying batch:', error);
        process.exit(1);
      });
  } else {
    // Retry all failed batches
    console.log('Retrying all failed batches...');
    retrier.retryAllBatches()
      .then(result => {
        console.log(`Retry complete: ${result.success} succeeded, ${result.failed} failed`);
        process.exit(result.failed > 0 ? 1 : 0);
      })
      .catch(error => {
        console.error('Error retrying batches:', error);
        process.exit(1);
      });
  }
}
