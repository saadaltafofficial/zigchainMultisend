import { coins } from '@cosmjs/amino';
import { SigningStargateClient } from '@cosmjs/stargate';
import { Coin, Input, MultiSendTx, Output, Recipient, ZigchainConfig } from './types';
import { WalletService } from './wallet';

export class MultiSendService {
  private walletService: WalletService;
  private networkConfig: ZigchainConfig;

  constructor(walletService: WalletService, networkConfig: ZigchainConfig) {
    this.walletService = walletService;
    this.networkConfig = networkConfig;
  }

  /**
   * Create a MultiSend transaction
   */
  async createMultiSendTx(recipients: Recipient[]): Promise<MultiSendTx> {
    const senderAddress = await this.walletService.getAddress();
    
    // Calculate total amount
    const totalAmount = recipients.reduce(
      (sum, recipient) => sum + BigInt(recipient.amount),
      BigInt(0)
    );
    
    // Create input (sender)
    const input: Input = {
      address: senderAddress,
      coins: [
        {
          denom: this.networkConfig.denom,
          amount: totalAmount.toString(),
        },
      ],
    };
    
    // Create outputs (recipients)
    const outputs: Output[] = recipients.map((recipient) => ({
      address: recipient.address,
      coins: [
        {
          denom: this.networkConfig.denom,
          amount: recipient.amount,
        },
      ],
    }));
    
    return {
      inputs: [input],
      outputs,
    };
  }

  /**
   * Execute MultiSend transaction
   */
  async executeMultiSend(recipients: Recipient[]): Promise<string> {
    try {
      const signingClient = await this.walletService.createSigningClient();
      const senderAddress = await this.walletService.getAddress();
      
      // Check balance before sending
      const balance = await this.walletService.getBalance();
      const totalAmount = recipients.reduce(
        (sum, recipient) => sum + BigInt(recipient.amount),
        BigInt(0)
      );
      
      if (BigInt(balance) < totalAmount) {
        throw new Error(`Insufficient balance. Required: ${totalAmount}, Available: ${balance}`);
      }
      
      // Create MultiSend message
      const multiSendTx = await this.createMultiSendTx(recipients);
      
      // Execute transaction
      const result = await this.sendMultiSendTx(signingClient, senderAddress, multiSendTx);
      
      return result.transactionHash;
    } catch (error) {
      console.error('Error executing MultiSend transaction:', error);
      throw error;
    }
  }

  /**
   * Send MultiSend transaction to the blockchain
   */
  async sendMultiSendTx(
    client: SigningStargateClient,
    sender: string,
    multiSendTx: MultiSendTx
  ) {
    // Create the MultiSend message
    const msg = {
      typeUrl: '/cosmos.bank.v1beta1.MsgMultiSend',
      value: {
        inputs: multiSendTx.inputs,
        outputs: multiSendTx.outputs,
      },
    };

    // Set gas price and fee
    const fee = {
      amount: coins(10000, this.networkConfig.denom),
      gas: '7500000', // Further increased gas limit for large batches with higher amounts
    };

    // Send the transaction
    return client.signAndBroadcast(sender, [msg], fee);
  }
}
