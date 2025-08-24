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

      // Referral commission (0.25% of prize) to winner's referrer
      const winnerDoc = await this.collections.players.findOne({ address }, { projection: { referrer: 1 } });
      const referrer = winnerDoc?.referrer;
      if (referrer && prize > 0 && !winnerData.isSimulation) {
        const commission = +(prize * 0.0025);
        await this.collections.players.updateOne(
          { address: referrer.toString() },
          {
            $set: { address: referrer.toString() },
            $inc: { referralEarnings: commission },
            $setOnInsert: { firstSeen: new Date(timestamp), totalBets: 0, totalAmountBet: 0, totalWins: 0, totalPrize: 0, referralCount: 0 },
          },
          { upsert: true }
        );
      }

      return true;
    } catch (error) {
      console.error('❌ StatsService.recordWinner error:', error.message);
      return false;
    }
  }

  // Register referral relationship (one-time set)
  async registerReferral({ address, referrer }) {
    if (!this.isReady() || !address || !referrer) return { success: false, error: 'Invalid parameters' };
    const addr = address.toString();
    const ref = referrer.toString();
    if (addr === ref) return { success: false, error: 'Self referral not allowed' };

    const player = await this.collections.players.findOne({ address: addr }, { projection: { referrer: 1 } });
    if (player?.referrer) {
      return { success: false, error: 'Referral already set' };
    }

    // Set referrer on player
    await this.collections.players.updateOne(
      { address: addr },
      {
        $set: { referrer: ref },
        $setOnInsert: { firstSeen: new Date(), totalBets: 0, totalAmountBet: 0, totalWins: 0, totalPrize: 0, referralCount: 0, referralEarnings: 0 },
      },
      { upsert: true }
    );

    // Increment referral count on referrer
    await this.collections.players.updateOne(
      { address: ref },
      {
        $inc: { referralCount: 1 },
        $setOnInsert: { firstSeen: new Date(), totalBets: 0, totalAmountBet: 0, totalWins: 0, totalPrize: 0, referralCount: 1, referralEarnings: 0 },
      },
      { upsert: true }
    );

    return { success: true };
  }

  async getPlayerStats(address) {
    if (!this.isReady() || !address) return null;
    return this.collections.players.findOne({ address: address.toString() }, { projection: { _id: 0 } });
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

    const [totals, winnersCount, betsCount] = await Promise.all([
      this.collections.players.aggregate([
        {
          $group: {
            _id: null,
            totalPlayers: { $sum: 1 },
            totalPrizePaid: { $sum: '$totalPrize' },
            totalBets: { $sum: '$totalBets' },
            totalAmountBet: { $sum: '$totalAmountBet' },
            totalReferralEarnings: { $sum: '$referralEarnings' },
            totalReferrals: { $sum: '$referralCount' },
          },
        },
      ]).toArray(),
      this.collections.games.estimatedDocumentCount(),
      this.collections.bets.estimatedDocumentCount(),
    ]);

    const t = totals[0] || {};
    return {
      connected: true,
      totalPlayers: t.totalPlayers || 0,
      totalPrizePaid: t.totalPrizePaid || 0,
      totalBets: t.totalBets || 0,
      totalAmountBet: t.totalAmountBet || 0,
      totalReferralEarnings: t.totalReferralEarnings || 0,
      totalReferrals: t.totalReferrals || 0,
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

  async getLuckiestWinnerOfDay() {
    if (!this.isReady()) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await this.collections.games
      .find({
        timestamp: {
          $gte: today.getTime(),
          $lt: tomorrow.getTime()
        }
      }, { projection: { _id: 0 } })
      .sort({ prize: -1 })
      .limit(1)
      .toArray();
    
    return result.length > 0 ? result[0] : null;
  }
}

const statsService = new StatsService();
module.exports = statsService;

