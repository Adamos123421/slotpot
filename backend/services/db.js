const { MongoClient } = require('mongodb');

let mongoClient = null;
let mongoDb = null;

async function connect(options = {}) {
  const defaultUri = 'mongodb+srv://roots:Nanato123@cluster0.q4vl70l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
  const uri = options.uri || process.env.MONGODB_URI || defaultUri;
  const dbName = options.dbName || process.env.MONGODB_DB_NAME || 'slotpot';

  if (!uri) {
    console.warn('⚠️ MONGODB_URI not set. Stats tracking will be disabled.');
    return null;
  }

  if (mongoDb) {
    return mongoDb;
  }

  try {
    mongoClient = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(dbName);
    console.log(`✅ Connected to MongoDB database: ${dbName}`);

    // Basic ping
    await mongoDb.command({ ping: 1 });
    console.log('📡 MongoDB ping successful');

    return mongoDb;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    mongoDb = null;
    return null;
  }
}

function getDb() {
  return mongoDb;
}

function isConnected() {
  return !!mongoDb;
}

function getCollection(name) {
  if (!mongoDb) return null;
  return mongoDb.collection(name);
}

async function close() {
  try {
    if (mongoClient) {
      await mongoClient.close();
      console.log('🔌 MongoDB connection closed');
    }
  } catch (error) {
    console.error('Error closing MongoDB connection:', error.message);
  } finally {
    mongoClient = null;
    mongoDb = null;
  }
}

module.exports = {
  connect,
  getDb,
  getCollection,
  isConnected,
  close,
};

