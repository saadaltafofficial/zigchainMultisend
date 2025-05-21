import fs from 'fs';
import path from 'path';
import { Recipient } from './types';
import { MultiSendService } from './multisend';

/**
 * Process recipients in batches and save transaction hashes
 */
export class BatchProcessor {
  private hashesFilePath: string;
  private failedBatchesPath: string;
  
  constructor(
    private batchSize: number = 400, 
    private maxRetries: number = 3,
    private retryDelayMs: number = 5000
  ) {
    this.hashesFilePath = path.join(process.cwd(), 'transaction-hashes.txt');
    this.failedBatchesPath = path.join(process.cwd(), 'failed-batches.json');
    
    // Initialize the hashes file with a header
    const timestamp = new Date().toISOString();
    fs.writeFileSync(
      this.hashesFilePath, 
      `# Zigchain MultiSend Transaction Hashes\n# Generated on: ${timestamp}\n\n`,
      'utf8'
    );
  }

  /**
   * Split recipients into batches of the specified size
   */
  splitIntoBatches(recipients: Recipient[]): Recipient[][] {
    const batches: Recipient[][] = [];
    
    for (let i = 0; i < recipients.length; i += this.batchSize) {
      batches.push(recipients.slice(i, i + this.batchSize));
    }
    
    return batches;
  }

  /**
   * Save a transaction hash to the file
   */
  saveTransactionHash(batchNumber: number, hash: string, recipientCount: number): void {
    const entry = `Batch #${batchNumber} | ${recipientCount} recipients | Hash: ${hash} | Time: ${new Date().toISOString()}\n`;
    
    fs.appendFileSync(this.hashesFilePath, entry, 'utf8');
    
    console.log(`Transaction hash saved to ${this.hashesFilePath}`);
  }

  /**
   * Sleep for a specified duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save failed batch for later retry
   */
  private saveFailedBatch(batchNumber: number, recipients: Recipient[], error: any): void {
    const failedBatch = {
      batchNumber,
      recipients,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };

    let failedBatches = [];
    try {
      if (fs.existsSync(this.failedBatchesPath)) {
        const content = fs.readFileSync(this.failedBatchesPath, 'utf8');
        failedBatches = JSON.parse(content);
      }
    } catch (err) {
      console.warn('Could not read failed batches file, creating new one');
    }

    failedBatches.push(failedBatch);
    fs.writeFileSync(this.failedBatchesPath, JSON.stringify(failedBatches, null, 2), 'utf8');
    console.log(`Saved failed batch #${batchNumber} to ${this.failedBatchesPath} for later retry`);
  }

  /**
   * Process all batches and execute transactions with retry mechanism
   */
  async processBatches(
    multiSendService: MultiSendService, 
    senderAddress: string,
    recipients: Recipient[],
    denom: string
  ): Promise<string[]> {
    const batches = this.splitIntoBatches(recipients);
    const hashes: string[] = [];
    
    console.log(`Processing ${batches.length} batches of up to ${this.batchSize} recipients each...`);
    
    for (let i = 0; i < batches.length; i++) {
      const batchRecipients = batches[i];
      const batchNumber = i + 1;
      
      console.log(`\n--- Processing Batch #${batchNumber} (${batchRecipients.length} recipients) ---`);
      
      try {
        // Display the first few and last few recipients in the batch
        const previewCount = 5;
        const displayRecipients = batchRecipients.length <= previewCount * 2 
          ? batchRecipients 
          : [
              ...batchRecipients.slice(0, previewCount),
              { address: '...', amount: 0 }, // Placeholder for skipped recipients
              ...batchRecipients.slice(batchRecipients.length - previewCount)
            ];
        
        displayRecipients.forEach((recipient, index) => {
          if (recipient.amount === 0 && recipient.address === '...') {
            console.log(`   ... (${batchRecipients.length - (previewCount * 2)} more recipients) ...`);
          } else {
            const actualIndex = index < previewCount 
              ? index 
              : batchRecipients.length - (displayRecipients.length - index - 1);
            console.log(`   ${actualIndex + 1}. ${recipient.address} - ${recipient.amount} ${denom}`);
          }
        });
        
        // Calculate total amount for this batch
        const totalAmount = batchRecipients.reduce((sum: number, recipient) => sum + Number(recipient.amount), 0);
        console.log(`\nBatch #${batchNumber} total amount: ${totalAmount} ${denom}`);
        
        // Execute the MultiSend transaction for this batch with retries
        let hash: string | null = null;
        let retryCount = 0;
        let lastError: any = null;
        
        while (retryCount <= this.maxRetries && !hash) {
          if (retryCount > 0) {
            console.log(`Retry attempt ${retryCount}/${this.maxRetries} for Batch #${batchNumber}...`);
            // Wait before retrying
            await this.sleep(this.retryDelayMs);
          }
          
          try {
            console.log(`Executing MultiSend transaction for Batch #${batchNumber}${retryCount > 0 ? ` (retry ${retryCount})` : ''}...`);
            const result = await multiSendService.executeMultiSend(batchRecipients);
            hash = result; // executeMultiSend returns the hash directly
          } catch (err) {
            lastError = err;
            console.error(`Error on attempt ${retryCount + 1}/${this.maxRetries + 1}:`, err instanceof Error ? err.message : err);
            retryCount++;
          }
        }
        
        if (!hash) {
          throw lastError || new Error('All retry attempts failed');
        }
        
        // Transaction succeeded
        hashes.push(hash);
        
        console.log(`\nBatch #${batchNumber} transaction successful!`);
        console.log(`Transaction hash: ${hash}`);
        console.log(`You can view the transaction at: https://explorer.zigchain.com/tx/${hash}`);
        
        // Save the hash to the file
        this.saveTransactionHash(batchNumber, hash, batchRecipients.length);
        
        // Wait a bit between batches to avoid overwhelming the network
        if (i < batches.length - 1) {
          console.log(`Waiting 3 seconds before processing next batch...`);
          await this.sleep(3000);
        }
        
      } catch (error) {
        console.error(`\nError executing MultiSend transaction for Batch #${batchNumber}:`, error);
        
        // Save the error to the file
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorEntry = `Batch #${batchNumber} | ${batchRecipients.length} recipients | ERROR: ${errorMessage} | Time: ${new Date().toISOString()}\n`;
        fs.appendFileSync(this.hashesFilePath, errorEntry, 'utf8');
        
        // Save failed batch for later retry
        this.saveFailedBatch(batchNumber, batchRecipients, error);
        
        // Wait longer after a failure before continuing
        if (i < batches.length - 1) {
          console.log(`Waiting 10 seconds before processing next batch after failure...`);
          await this.sleep(10000);
        }
      }
    }
    
    return hashes;
  }
}
