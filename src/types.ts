// Types for Zigchain MultiSend functionality

export interface Coin {
  denom: string;
  amount: string;
}

export interface Input {
  address: string;
  coins: Coin[];
}

export interface Output {
  address: string;
  coins: Coin[];
}

export interface MultiSendTx {
  inputs: Input[];
  outputs: Output[];
}

export interface Recipient {
  address: string;
  amount: string;
}

export interface WalletConfig {
  mnemonic?: string;
  privateKey?: string;
  prefix?: string;
}

export interface ZigchainConfig {
  rpcUrl: string;
  chainId: string;
  denom: string;
}
