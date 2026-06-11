const https = require('https');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'financialmodelingprep.com',
      path,
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const ticker = (req.query.ticker || '').replace('.AS', '').toUpperCase();
  const KEY = process.env.FMP_KEY || 'Aob1qs04qBBD9v3rARxjWgSGA9fcZda2';

  try {
    const raw = await get(`/api/v3/ratios-ttm/${ticker}?apikey=${KEY}`);
    const json = JSON.parse(raw);
    return res.status(200).json({ debug: true, ticker, raw: json });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
