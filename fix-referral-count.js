const { MongoClient } = require('mongodb');

async function fixReferralCount() {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('slotpot');
    const collection = db.collection('playerStats');
    
    // Find Adam Ton's record
    const adamTon = await collection.findOne({ 
      address: 'EQAXphchCzlO8CfbqvvTQZcuU7ku7JCCZyBAN7AamEET-oVb' 
    });
    
    console.log('Adam Ton current record:', adamTon);
    
    // Update referral count to 1
    const result = await collection.updateOne(
      { address: 'EQAXphchCzlO8CfbqvvTQZcuU7ku7JCCZyBAN7AamEET-oVb' },
      { $set: { referralCount: 1 } }
    );
    
    console.log('Update result:', result);
    
    // Verify the update
    const updatedAdamTon = await collection.findOne({ 
      address: 'EQAXphchCzlO8CfbqvvTQZcuU7ku7JCCZyBAN7AamEET-oVb' 
    });
    
    console.log('Adam Ton updated record:', updatedAdamTon);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

fixReferralCount();


