import { validateConfig, walletConfig, zigchainConfig, getRecipientsFromCsv, csvFilePath } from './config';
import { WalletService } from './wallet';
import { MultiSendService } from './multisend';

/**
 * This script tests the MultiSend functionality without actually sending a transaction
 * It's useful for verifying your configuration and seeing what the transaction would look like
 */
async function testMultiSend() {
  try {
    // Validate configuration
    if (!(await validateConfig())) {
      process.exit(1);
    }
    
    // Load recipients from CSV file
    const recipients = await getRecipientsFromCsv(csvFilePath);
    
    // Verify we have recipients
    if (recipients.length === 0) {
      console.error('Error: No recipients found in CSV file');
      process.exit(1);
    }

    console.log('Zigchain MultiSend Test Mode');
    console.log('--------------------------');
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
    
    // Initialize MultiSend service
    const multiSendService = new MultiSendService(walletService, zigchainConfig);
    
    // Display recipients
    console.log('\nRecipients:');
    recipients.forEach((recipient, index) => {
      console.log(`${index + 1}. ${recipient.address} - ${recipient.amount} ${zigchainConfig.denom}`);
    });
    
    // Calculate total amount
    const totalAmount = recipients.reduce(
      (sum, recipient) => sum + BigInt(recipient.amount),
      BigInt(0)
    );
    console.log(`\nTotal amount to send: ${totalAmount} ${zigchainConfig.denom}`);
    
    // Create MultiSend transaction (but don't send it)
    const multiSendTx = await multiSendService.createMultiSendTx(recipients);
    
    console.log('\nTransaction Preview:');
    console.log(JSON.stringify(multiSendTx, null, 2));
    
    console.log('\nTest completed successfully. To send the actual transaction, run: npm start');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the test function
testMultiSend().catch(console.error);
