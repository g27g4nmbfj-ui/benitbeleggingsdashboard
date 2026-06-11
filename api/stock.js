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
  const KEY = process.env.FMP_KEY;

  if (!ticker) return res.status(400).json({ error: 'Geen ticker' });
  if (!KEY) return res.status(500).json({ error: 'Geen API key geconfigureerd' });

  try {
    // Haal key metrics en ratios parallel op
    const [ratiosRaw, profileRaw] = await Promise.all([
      get(`/api/v3/ratios-ttm/${ticker}?apikey=${KEY}`),
      get(`/api/v3/key-metrics-ttm/${ticker}?apikey=${KEY}`)
    ]);

    const ratios = JSON.parse(ratiosRaw);
    const metrics = JSON.parse(profileRaw);

    const r = Array.isArray(ratios) ? ratios[0] : ratios;
    const m = Array.isArray(metrics) ? metrics[0] : metrics;

    // FMP veldnamen
    const fwdpe = r?.priceEarningsRatioTTM ?? m?.peRatioTTM ?? null;
    const peg   = r?.priceEarningsToGrowthRatioTTM ?? m?.pegRatioTTM ?? null;
    const roe   = m?.roeTTM != null ? Math.round(m.roeTTM * 100) : null;
    const margin = r?.operatingProfitMarginTTM != null ? Math.round(r.operatingProfitMarginTTM * 100) : null;
    const epsy  = m?.revenueGrowthTTM != null ? Math.round(m.revenueGrowthTTM * 100) : null;

    return res.status(200).json({
      ticker,
      fwdpe:  fwdpe != null ? parseFloat(fwdpe.toFixed(2)) : null,
      peg:    peg   != null ? parseFloat(peg.toFixed(2))   : null,
      roe:    roe,
      margin: margin,
      epsy:   epsy,
    });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
