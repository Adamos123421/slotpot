const db = require('./db');

class StatsService {
  constructor() {
    this.initialized = false;
    this.collections = {
      players: null,
      games: null,
      bets: null,
    };
  }

  async initialize() {
    try {
      if (!db.isConnected()) {
        // Try to connect if not already connected
        await db.connect();
      }
      if (!db.isConnected()) {
        console.warn('⚠️ StatsService disabled (no DB connection)');
        return false;
      }

      const mongo = db.getDb();
      this.collections.players = mongo.collection('playerStats');
      this.collections.games = mongo.collection('games');
      this.collections.bets = mongo.collection('bets');

      // Indexes
      await Promise.all([
        this.collections.players.createIndex({ address: 1 }, { unique: true }),
        this.collections.players.createIndex({ totalPrize: -1 }),
        this.collections.players.createIndex({ totalWins: -1 }),
        this.collections.players.createIndex({ referrer: 1 }),
        this.collections.players.createIndex({ referralEarnings: -1 }),
        this.collections.bets.createIndex({ address: 1, timestamp: -1 }),
        this.collections.bets.createIndex({ roundNumber: -1 }),
        this.collections.games.createIndex({ roundNumber: -1 }, { unique: true }),
        this.collections.games.createIndex({ timestamp: -1 }),
      ]);

      this.initialized = true;
      console.log('📊 StatsService initialized');
      
      // Process any pending user registrations
      try {
        const userService = require('./userService');
        await userService.processPendingRegistrations();
      } catch (error) {
        console.error('❌ Error processing pending registrations:', error.message);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize StatsService:', error.message);
      this.initialized = false;
      return false;
    }
  }

  isReady() {
    return this.initialized && db.isConnected();
  }

  async recordBet({ address, amount, roundNumber = null, username = null, timestamp = Date.now() }) {
    try {
      if (!this.isReady() || !address || amount === undefined) return false;

      // Insert bet record
      await this.collections.bets.insertOne({
        address: address.toString(),
        amount: Number(amount),
        roundNumber,
        username,
        timestamp,
      });

      // Upsert player stats
      const update = {
        $set: {
          address: address.toString(),
          usernameSnapshot: username || null,
          lastSeen: new Date(timestamp),
        },
        $inc: {
          totalBets: 1,
          totalAmountBet: Number(amount),
        },
        $setOnInsert: {
          totalWins: 0,
          totalPrize: 0,
          referralCount: 0,
          referralEarnings: 0,
          firstSeen: new Date(timestamp),
        },
      };
      await this.collections.players.updateOne({ address: address.toString() }, update, { upsert: true });

      return true;
    } catch (error) {
      console.error('❌ StatsService.recordBet error:', error.message);
      return false;
    }
  }

  async recordWinner(winnerData) {
    try {
      if (!this.isReady() || !winnerData) return false;
      const address = (winnerData.fullAddress || winnerData.winnerAddress || winnerData.winner || '').toString();
      if (!address) return false;

      const prize = Number(winnerData.prize || 0);
      const username = winnerData.username || winnerData.winnerName || null;
      const roundNumber = winnerData.roundNumber || null;
      const timestamp = winnerData.timestamp || Date.now();

      // Insert/Upsert game record
      await this.collections.games.updateOne(
        { roundNumber },
        {
          $set: {
            roundNumber,
            winnerAddress: address,
            winnerDisplay: winnerData.winner || null,
            username,
            prize,
            totalBettors: winnerData.totalBettors || null,
            isSimulation: !!winnerData.isSimulation,
            timestamp,
          },
        },
        { upsert: true }
      );

      // Update winner's player stats
      await this.collections.players.updateOne(
        { address },
        {
          $set: {
            address,
            usernameSnapshot: username,
            lastSeen: new Date(timestamp),
          },
          $inc: {
            totalWins: 1,
            totalPrize: prize,
          },
          $setOnInsert: {
            firstSeen: new Date(timestamp),
            totalBets: 0,
            totalAmountBet: 0,
            referralCount: 0,
            referralEarnings: 0,
          },
        },
        { upsert: true }
      );

      // Referral commission system:
      // 1. Winner gets 10% of prize as referral bonus
      // 2. Winner's referrer gets 0.5% of total prize (10% of the 5% fee we take)
      const winnerDoc = await this.collections.players.findOne({ address }, { projection: { referrer: 1 } });
      const referrer = winnerDoc?.referrer;
      
      if (prize > 0 && !winnerData.isSimulation) {
        // Winner gets 10% of prize as referral bonus
        const winnerReferralBonus = +(prize * 0.10);
        await this.collections.players.updateOne(
          { address },
          {
            $inc: { referralEarnings: winnerReferralBonus }
          }
        );
        
        // If winner has a referrer, give them 0.5% of total prize
        if (referrer) {
          const referrerCommission = +(prize * 0.005); // 0.5% of total prize
          await this.collections.players.updateOne(
            { address: referrer.toString() },
            {
              $set: { address: referrer.toString() },
              $inc: { referralEarnings: referrerCommission },
              $setOnInsert: { firstSeen: new Date(timestamp), totalBets: 0, totalAmountBet: 0, totalWins: 0, totalPrize: 0, referralCount: 0 },
            },
            { upsert: true }
          );
          
          console.log(`🎯 Referral commission: Winner ${address.slice(0, 8)}... got ${winnerReferralBonus.toFixed(6)} TON bonus, referrer ${referrer.slice(0, 8)}... got ${referrerCommission.toFixed(6)} TON commission (0.5% of prize)`);
        } else {
          console.log(`🎯 Referral bonus: Winner ${address.slice(0, 8)}... got ${winnerReferralBonus.toFixed(6)} TON bonus (no referrer)`);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ StatsService.recordWinner error:', error.message);
      return false;
    }
  }

  // Register referral relationship (one-time set)
  async registerReferral({ address, referrer }) {
    console.log(`🎯 StatsService.registerReferral called: ${address?.slice(0, 8)}... referred by ${referrer?.slice(0, 8)}...`);
    
    if (!this.isReady()) {
      console.log(`❌ StatsService not ready`);
      return { success: false, error: 'Stats service not ready' };
    }
    
    if (!address || !referrer) {
      console.log(`❌ Missing address or referrer`);
      return { success: false, error: 'Invalid parameters' };
    }
    
    const addr = address.toString();
    const ref = referrer.toString();
    
    if (addr === ref) {
      console.log(`❌ Self referral not allowed`);
      return { success: false, error: 'Self referral not allowed' };
    }

    // Check if player already has a referrer
    const player = await this.collections.players.findOne({ address: addr }, { projection: { referrer: 1, totalBets: 1, totalWins: 1 } });
    if (player?.referrer) {
      console.log(`❌ Player ${addr.slice(0, 8)}... already has referrer ${player.referrer.slice(0, 8)}...`);
      return { success: false, error: 'Referral already set' };
    }

    // Check if player has betting activity (optional check - can be removed if you want to allow referrals for existing users)
    if (player && (player.totalBets > 0 || player.totalWins > 0)) {
      console.log(`❌ Player ${addr.slice(0, 8)}... already has betting activity (${player.totalBets} bets, ${player.totalWins} wins)`);
      return { success: false, error: 'User already has betting activity. Referrals only work for new users.' };
    }

    // Check if referrer exists, and if not, create them in the database
    let referrerStats = await this.collections.players.findOne({ address: ref });
    if (!referrerStats) {
      console.log(`📊 Referrer ${ref.slice(0, 8)}... not found in database, creating entry...`);
      try {
        await this.collections.players.updateOne(
          { address: ref },
          {
            $setOnInsert: { 
              firstSeen: new Date(),
              lastSeen: new Date(),
              totalBets: 0,
              totalAmountBet: 0,
              totalWins: 0,
              totalPrize: 0,
              referralCount: 0,
              referralEarnings: 0,
              usernameSnapshot: `Player_${ref.slice(-4)}`
            }
          },
          { upsert: true }
        );
        referrerStats = await this.collections.players.findOne({ address: ref });
        console.log(`✅ Created referrer entry in database: ${ref.slice(0, 8)}...`);
      } catch (error) {
        console.error(`❌ Failed to create referrer entry: ${error.message}`);
        return { success: false, error: 'Failed to create referrer entry in database' };
      }
    }

    try {
      // Set referrer on player
      await this.collections.players.updateOne(
        { address: addr },
        {
          $set: { referrer: ref },
          $setOnInsert: { firstSeen: new Date(), totalBets: 0, totalAmountBet: 0, totalWins: 0, totalPrize: 0, referralCount: 0, referralEarnings: 0 },
        },
        { upsert: true }
      );

      // Ensure referrer exists in database (no need to increment referralCount since it's calculated dynamically)
      console.log(`🎯 Ensuring referrer ${ref.slice(0, 8)}... exists in database`);
      const updateResult = await this.collections.players.updateOne(
        { address: ref },
        {
          $setOnInsert: { firstSeen: new Date(), totalBets: 0, totalAmountBet: 0, totalWins: 0, totalPrize: 0, referralEarnings: 0 },
        },
        { upsert: true }
      );
      
      console.log(`🎯 Referrer update result:`, {
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
        upsertedCount: updateResult.upsertedCount,
        upsertedId: updateResult.upsertedId
      });

      console.log(`✅ Referral registered successfully: ${addr.slice(0, 8)}... referred by ${ref.slice(0, 8)}...`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Database error during referral registration:`, error);
      return { success: false, error: 'Database error during referral registration' };
    }
  }

  async getPlayerStats(address) {
    if (!this.isReady() || !address) return null;
    
    const addr = address.toString();
    
    // Get the player's basic stats
    const player = await this.collections.players.findOne({ address: addr }, { projection: { _id: 0 } });
    
    if (!player) return null;
    
    // Calculate referral count dynamically by counting how many people have this address as referrer
    const referralCount = await this.collections.players.countDocuments({ referrer: addr });
    console.log(`📊 getPlayerStats for ${addr.slice(0, 8)}... - calculated referralCount:`, referralCount);
    
    // Return player stats with calculated referral count
    const result = {
      ...player,
      referralCount: referralCount
    };
    
    console.log(`📊 getPlayerStats for ${addr.slice(0, 8)}... - final result:`, result);
    return result;
  }

  async getLeaderboard({ by = 'totalPrize', limit = 10 } = {}) {
    if (!this.isReady()) return [];
    const sort = by === 'wins' ? { totalWins: -1, totalPrize: -1 } : { totalPrize: -1, totalWins: -1 };
    return this.collections.players
      .find({}, { projection: { _id: 0 } })
      .sort(sort)
      .limit(Number(limit) || 10)
      .toArray();
  }

  async getSummary() {
    if (!this.isReady()) return { connected: false };

    const [totals, winnersCount, betsCount, totalReferrals] = await Promise.all([
      this.collections.players.aggregate([
        {
          $group: {
            _id: null,
            totalPlayers: { $sum: 1 },
            totalPrizePaid: { $sum: '$totalPrize' },
            totalBets: { $sum: '$totalBets' },
            totalAmountBet: { $sum: '$totalAmountBet' },
            totalReferralEarnings: { $sum: '$referralEarnings' },
          },
        },
      ]).toArray(),
      this.collections.games.estimatedDocumentCount(),
      this.collections.bets.estimatedDocumentCount(),
      this.collections.players.countDocuments({ referrer: { $exists: true, $ne: null } }),
    ]);

    const t = totals[0] || {};
    return {
      connected: true,
      totalPlayers: t.totalPlayers || 0,
      totalPrizePaid: t.totalPrizePaid || 0,
      totalBets: t.totalBets || 0,
      totalAmountBet: t.totalAmountBet || 0,
      totalReferralEarnings: t.totalReferralEarnings || 0,
      totalReferrals: totalReferrals || 0,
      totalGames: winnersCount || 0,
      totalBetRecords: betsCount || 0,
    };
  }

  async getRecentGames(limit = 10) {
    if (!this.isReady()) return [];
    return this.collections.games
      .find({}, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .limit(Number(limit) || 10)
      .toArray();
  }
}

const statsService = new StatsService();
module.exports = statsService;

