const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'slotpot';
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(2);
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    console.log('PING_OK', dbName);
  } catch (e) {
    console.error('PING_FAIL', e.message);
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
  }
}

main();

