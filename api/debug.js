// Diagnose: test de NIEUWE /stable/ FMP endpoints
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const symbol = req.query.symbol || 'MSFT';
  const key = process.env.FMP_API_KEY || process.env.FMP_KEY;
  const out = { symbol, keyAanwezig: !!key, resultaten: {} };
  if (!key) return res.status(200).json(out);

  const endpoints = {
    quote:           `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${key}`,
    ratios_ttm:      `https://financialmodelingprep.com/stable/ratios-ttm?symbol=${symbol}&apikey=${key}`,
    key_metrics_ttm: `https://financialmodelingprep.com/stable/key-metrics-ttm?symbol=${symbol}&apikey=${key}`,
    metrics:         `https://financialmodelingprep.com/stable/metrics?symbol=${symbol}&apikey=${key}`,
    ratios:          `https://financialmodelingprep.com/stable/ratios?symbol=${symbol}&apikey=${key}`
  };

  for (const [naam, url] of Object.entries(endpoints)) {
    try {
      const r = await fetch(url);
      const tekst = await r.text();
      let data;
      try { data = JSON.parse(tekst); } catch { data = tekst.substring(0, 150); }
      out.resultaten[naam] = { status: r.status, data: Array.isArray(data) ? data[0] : data };
    } catch (e) {
      out.resultaten[naam] = { fout: e.message };
    }
  }
  res.status(200).json(out);
}
