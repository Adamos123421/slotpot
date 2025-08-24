import { Address, beginCell, Cell, toNano } from '@ton/core';
import { TonClient } from '@ton/ton';

// Contract configuration
export const JACKPOT_CONTRACT_CONFIG = {
  // ⚠️ IMPORTANT: Replace this with your actual deployed contract address!
  // This is just a placeholder - transactions will fail with wrong address
  address: "EQAU8ORrgJWbNGDSiWDgF9p37hNv1q8qkbMb7ZhiHNnSqjo_",
  
  // Admin configuration - in production, use environment variables
  adminMnemonic: (process.env.REACT_APP_ADMIN_MNEMONIC || "").split(' ') || [],
  
  // TON Client configuration
  endpoint: process.env.REACT_APP_TON_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: "cb6a181146fafbe2adc51d3a21d27341aa8a93cbf581e03a80e9e7203a3abd65"
};

// Message constructors for contract interactions
export const ContractMessages = {
  // Admin messages
  startJackpot: (queryId = 0) => {
    return beginCell()
      .storeUint(0x12345678, 32) // Replace with actual op code
      .storeUint(queryId, 64)
      .endCell();
  },

  endJackpot: (queryId = 0) => {
    return beginCell()
      .storeUint(0x87654321, 32) // Replace with actual op code  
      .storeUint(queryId, 64)
      .endCell();
  },

  placeBet: (queryId = 0) => {
    return beginCell()
      .storeUint(0x03, 32) // PlaceBet opcode as specified in contract
      .storeUint(queryId, 64) // query_id as uint64
      .endCell();
  }
};

export class JackpotContract {
  constructor() {
    this.client = new TonClient({
      endpoint: JACKPOT_CONTRACT_CONFIG.endpoint,
      apiKey: JACKPOT_CONTRACT_CONFIG.apiKey
    });
    
    this.contractAddress = Address.parse( "EQAU8ORrgJWbNGDSiWDgF9p37hNv1q8qkbMb7ZhiHNnSqjo_");
    
    // Debug contract address on initialization
    console.log('🏗️ JackpotContract initialized:', {
      configAddress: JACKPOT_CONTRACT_CONFIG.address,
      parsedAddress: this.contractAddress.toString(),
      fromEnv: !!process.env.REACT_APP_CONTRACT_ADDRESS
    });
  }

  // Contract getters - these call the smart contract's get methods
  async getTotalJackpot() {
    try {
      const result = await this.client.runMethod(
        this.contractAddress,
        "getTotalJackpot"
      );
      
      // Parse the result from stack
      const jackpotAmount = result.stack.readBigNumber();
      return Number(jackpotAmount) / 1e9; // Convert from nanotons to TON
    } catch (error) {
      console.error('Error fetching jackpot amount:', error);
      return 0;
    }
  }

  async isJackpotActive() {
    try {
      const result = await this.client.runMethod(
        this.contractAddress,
        "isJackpotActive"
      );
      
      return result.stack.readBoolean();
    } catch (error) {
      console.error('Error fetching jackpot status:', error);
      return false;
    }
  }

  async getBetCount() {
    try {
      const result = await this.client.runMethod(
        this.contractAddress,
        "getBetCount"
      );
      
      return result.stack.readNumber();
    } catch (error) {
      console.error('Error fetching bet count:', error);
      return 0;
    }
  }

  async getBettorAmount(bettorAddress) {
    try {
      const result = await this.client.runMethod(
        this.contractAddress,
        "getBettorAmount",
        [
          { type: 'slice', cell: beginCell().storeAddress(Address.parse(bettorAddress)).endCell() }
        ]
      );
      
      const amount = result.stack.readBigNumber();
      return Number(amount) / 1e9; // Convert from nanotons to TON
    } catch (error) {
      console.error('Error fetching bettor amount:', error);
      return 0;
    }
  }

  async getWinningProbability(bettorAddress) {
    try {
      const result = await this.client.runMethod(
        this.contractAddress,
        "getWinningProbability",
        [
          { type: 'slice', cell: beginCell().storeAddress(Address.parse(bettorAddress)).endCell() }
        ]
      );
      
      const probability = result.stack.readNumber();
      return probability / 100; // Convert from basis points to percentage
    } catch (error) {
      console.error('Error fetching winning probability:', error);
      return 0;
    }
  }

  async getAllBettors() {
    try {
      const result = await this.client.runMethod(
        this.contractAddress,
        "getAllBettors"
      );
      
      // Parse the dictionary result
      // This will return a map of addresses to amounts
      const bettorsDict = result.stack.readCellOpt();
      
      if (!bettorsDict) return {};
      
      // Parse the dictionary - implementation depends on exact contract structure
      // For now, return empty object - you'll need to implement dictionary parsing
      return {};
    } catch (error) {
      console.error('Error fetching all bettors:', error);
      return {};
    }
  }

  async getLastWinner() {
    try {
      const result = await this.client.runMethod(
        this.contractAddress,
        "getLastWinner"
      );
      
      const winnerCell = result.stack.readCellOpt();
      if (!winnerCell) return null;
      
      // Parse address from cell
      const slice = winnerCell.beginParse();
      const winnerAddress = slice.loadAddress();
      
      return winnerAddress?.toString();
    } catch (error) {
      console.error('Error fetching last winner:', error);
      return null;
    }
  }

  async getLastPrizeAmount() {
    try {
      const result = await this.client.runMethod(
        this.contractAddress,
        "getLastPrizeAmount"
      );
      
      const prizeAmount = result.stack.readBigNumber();
      return Number(prizeAmount) / 1e9; // Convert from nanotons to TON
    } catch (error) {
      console.error('Error fetching last prize amount:', error);
      return 0;
    }
  }

  async getContractBalance() {
    try {
      const result = await this.client.runMethod(
        this.contractAddress,
        "getBalance"
      );
      
      const balance = result.stack.readBigNumber();
      return Number(balance) / 1e9; // Convert from nanotons to TON
    } catch (error) {
      console.error('Error fetching contract balance:', error);
      return 0;
    }
  }

  // Transaction builders for sending to the contract
  buildBetTransaction(betAmount, senderAddress) {
    // Ensure betAmount is a valid number
    const numericBetAmount = Number(betAmount);
    if (isNaN(numericBetAmount)) {
      throw new Error(`Invalid bet amount: ${betAmount}`);
    }
    
    // Add 0.05 TON fee to the bet amount for the transaction
    const totalAmount = numericBetAmount + 0.05;
    // Ensure proper string formatting for toNano function
    const totalAmountString = totalAmount.toFixed(9); // Use 9 decimal places for precision
    const totalAmountNano = toNano(totalAmountString);
    // Generate unique query_id for this bet
    const queryId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    
    const payload = ContractMessages.placeBet(queryId);
    
    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
      messages: [
        {
          address: this.contractAddress.toString(),
          amount: totalAmountNano.toString(),
          payload: payload.toBoc().toString('base64')
        }
      ]
    };
    

    
    return transaction;
  }

  buildStartJackpotTransaction() {
    return {
      validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
      messages: [
        {
          address: this.contractAddress.toString(),
          amount: toNano('0.05').toString(), // Gas fee
          payload: ContractMessages.startJackpot(Date.now()).toBoc().toString('base64')
        }
      ]
    };
  }

  buildEndJackpotTransaction() {
    return {
      validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
      messages: [
        {
          address: this.contractAddress.toString(),
          amount: toNano('0.05').toString(), // Gas fee
          payload: ContractMessages.endJackpot(Date.now()).toBoc().toString('base64')
        }
      ]
    };
  }

  // Utility method to get comprehensive contract state
  async getContractState() {
    try {
      const [
        totalJackpot,
        isActive,
        betCount,
        lastWinner,
        lastPrizeAmount,
        contractBalance
      ] = await Promise.all([
        this.getTotalJackpot(),
        this.isJackpotActive(),
        this.getBetCount(),
        this.getLastWinner(),
        this.getLastPrizeAmount(),
        this.getContractBalance()
      ]);

      return {
        totalJackpot,
        isActive,
        betCount,
        lastWinner,
        lastPrizeAmount,
        contractBalance,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching contract state:', error);
      return {
        totalJackpot: 0,
        isActive: false,
        betCount: 0,
        lastWinner: null,
        lastPrizeAmount: 0,
        contractBalance: 0,
        timestamp: Date.now(),
        error: error.message
      };
    }
  }
}

// Create a singleton instance
export const jackpotContract = new JackpotContract();

// Export utility functions
export const formatTonAmount = (amount) => {
  return Number(amount).toFixed(3);
};

export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Utility function to decode and verify PlaceBet message
export const decodePlaceBetMessage = (base64Payload) => {
  try {
    const cell = Cell.fromBase64(base64Payload);
    const slice = cell.beginParse();
    
    const opCode = slice.loadUint(32);
    const queryId = slice.loadUint(64);
    
    console.log(`🔍 Decoded PlaceBet message:`, {
      opCode: `0x${opCode.toString(16).padStart(2, '0')}`,
      queryId,
      isCorrectOpCode: opCode === 0x03
    });
    
    return {
      opCode,
      queryId,
      isValid: opCode === 0x03
    };
  } catch (error) {
    console.error('Error decoding PlaceBet message:', error);
    return null;
  }
}; 