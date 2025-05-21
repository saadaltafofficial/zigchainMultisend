import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import { Recipient } from './types';

/**
 * Read recipients from a CSV file
 * @param filePath Path to the CSV file
 * @returns Promise that resolves to an array of Recipients
 */
export async function readRecipientsFromCsv(filePath: string): Promise<Recipient[]> {
  return new Promise((resolve, reject) => {
    const results: Recipient[] = [];
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      reject(new Error(`CSV file not found: ${filePath}`));
      return;
    }
    
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => {
        // Validate the data has the required fields
        if (!data.address || !data.amount) {
          console.warn('Skipping invalid row in CSV:', data);
          return;
        }
        
        // Add to results
        results.push({
          address: data.address.trim(),
          amount: data.amount.trim()
        });
      })
      .on('end', () => {
        if (results.length === 0) {
          reject(new Error('No valid recipients found in the CSV file'));
          return;
        }
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Get the default CSV file path
 * @returns The absolute path to the default recipients.csv file
 */
export function getDefaultCsvPath(): string {
  return path.resolve(process.cwd(), 'recipients.csv');
}
