# Zigchain MultiSend

A TypeScript project for interacting with the Zigchain Cosmos chain to perform MultiSend transactions. Supports sending tokens to large numbers of recipients efficiently through batching and automatic retry mechanisms.

## Features

- Connect to Zigchain testnet API
- Create and sign MultiSend transactions
- Send different amounts to multiple addresses in a single transaction
- Process large recipient lists in configurable batches
- Automatic retry mechanism for failed transactions
- Track transaction hashes and errors in a log file
- Support for both mnemonic and private key wallet creation
- Command-line options for customizing batch size and retry settings

## Prerequisites

- Node.js (v14 or higher)
- npm

## Installation

```bash
npm install
```

## Usage

1. Configure your wallet and recipients in the `.env` file (see `.env.example`)
   - You can use either a mnemonic phrase or a private key for wallet creation
   - Set either `MNEMONIC` or `PRIVATE_KEY` in your `.env` file

2. Prepare your recipients in a CSV file (default: `recipients.csv`)
   - Format: `address,amount` (one recipient per line)
   - Example: `zig1abc123...,1000`

3. Build the project:

```bash
npm run build
```

4. Run the application with optional command-line arguments:

```bash
# Run with default settings (batch size: 400)
npm start

# Run with custom batch size
npm start -- --batch-size=300

# Run with custom retry settings
npm start -- --max-retries=5 --retry-delay=10000

# Retry all previously failed batches
npm start -- --retry

# Retry a specific batch
npm start -- --retry-batch=2

# Display help
npm start -- --help
```

## Batch Processing

The application processes recipients in batches to avoid transaction failures due to gas limits. By default, it uses batches of 400 recipients, but you can adjust this with the `--batch-size` option.

Each batch is processed separately, and transaction hashes are saved to `transaction-hashes.txt`. If a batch fails, it's saved to `failed-batches.json` for later retry.

## Retry Mechanism

The application includes an automatic retry mechanism for failed transactions. By default, it will retry each batch up to 3 times before marking it as failed. You can adjust this with the `--max-retries` option.

To retry failed batches from a previous run:

```bash
npm start -- --retry
```

## API Reference

This project uses the Zigchain testnet API at https://testnet-api.zigchain.com/ and specifically the `/cosmos.bank.v1beta1.Msg/MultiSend` endpoint for sending tokens to multiple recipients.

## License

ISC
