import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { StargateClient, SigningStargateClient } from '@cosmjs/stargate';
import { WalletConfig, ZigchainConfig } from './types';
import { fromHex } from '@cosmjs/encoding';

export class WalletService {
  private config: WalletConfig;
  private networkConfig: ZigchainConfig;

  constructor(walletConfig: WalletConfig, networkConfig: ZigchainConfig) {
    this.config = walletConfig;
    this.networkConfig = networkConfig;
  }

  /**
   * Create a wallet from mnemonic or private key
   */
  async createWallet(): Promise<DirectSecp256k1HdWallet | DirectSecp256k1Wallet> {
    // Check if private key is provided
    if (this.config.privateKey) {
      // Convert hex private key to Uint8Array
      const privateKey = fromHex(this.config.privateKey.startsWith('0x') 
        ? this.config.privateKey.substring(2) 
        : this.config.privateKey);
      
      return DirectSecp256k1Wallet.fromKey(privateKey, this.config.prefix || 'zig');
    }
    
    // Fallback to mnemonic if private key is not provided
    if (!this.config.mnemonic) {
      throw new Error('Either mnemonic or private key must be provided in wallet configuration');
    }
    
    return DirectSecp256k1HdWallet.fromMnemonic(this.config.mnemonic, {
      prefix: this.config.prefix || 'zig',
    });
  }

  /**
   * Get account address from wallet
   */
  async getAddress(): Promise<string> {
    const wallet = await this.createWallet();
    const [firstAccount] = await wallet.getAccounts();
    return firstAccount.address;
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<string> {
    const address = await this.getAddress();
    const client = await StargateClient.connect(this.networkConfig.rpcUrl);
    const balance = await client.getBalance(address, this.networkConfig.denom);
    return balance.amount;
  }

  /**
   * Create a signing client for transactions
   */
  async createSigningClient(): Promise<SigningStargateClient> {
    const wallet = await this.createWallet();
    return SigningStargateClient.connectWithSigner(
      this.networkConfig.rpcUrl,
      wallet
    );
  }
}
