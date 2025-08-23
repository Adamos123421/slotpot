const fetch = require('node-fetch');

async function main() {
  try {
    const res = await fetch('http://localhost:5002/api/stats/recent-games');
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.error('REQ_FAIL', e.message);
    process.exit(1);
  }
}

main();

