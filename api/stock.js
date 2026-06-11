const https = require('https');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'finnhub.io',
      path, method: 'GET',
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
  const KEY = process.env.FINNHUB_KEY;

  try {
    const raw = await get(`/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${KEY}`);
    const json = JSON.parse(raw);
    const m = json?.metric || {};

    return res.status(200).json({
      ticker,
      fwdpe:  m['forwardPE']       != null ? parseFloat(m['forwardPE'].toFixed(2))  : null,
      peg:    m['forwardPEG']      != null ? parseFloat(m['forwardPEG'].toFixed(2)) : null,
      roe:    m['roeTTM']          != null ? Math.round(m['roeTTM'])                : null,
      margin: m['operatingMarginTTM'] != null ? Math.round(m['operatingMarginTTM']) : null,
      epsy:   m['epsGrowthTTMYoy'] != null ? Math.round(m['epsGrowthTTMYoy'])       : null,
    });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
