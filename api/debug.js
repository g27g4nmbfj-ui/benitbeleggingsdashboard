// Diagnose-endpoint: laat zien wat FMP precies terugstuurt voor een ticker
// Open in browser: https://JOUW-APP.vercel.app/api/debug?symbol=MSFT
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const symbol = req.query.symbol || 'MSFT';
  const key = process.env.FMP_API_KEY || process.env.FMP_KEY;

  const out = { symbol, keyAanwezig: !!key, keyLengte: key ? key.length : 0, resultaten: {} };
  if (!key) return res.status(200).json(out);

  const endpoints = {
    quote:        `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${key}`,
    ratios_ttm:   `https://financialmodelingprep.com/api/v3/ratios-ttm/${symbol}?apikey=${key}`,
    keymetrics:   `https://financialmodelingprep.com/api/v3/key-metrics-ttm/${symbol}?apikey=${key}`,
    stable_quote: `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${key}`
  };

  for (const [naam, url] of Object.entries(endpoints)) {
    try {
      const r = await fetch(url);
      const tekst = await r.text();
      let data;
      try { data = JSON.parse(tekst); } catch { data = tekst.substring(0, 200); }
      out.resultaten[naam] = { status: r.status, data: Array.isArray(data) ? data[0] : data };
    } catch (e) {
      out.resultaten[naam] = { fout: e.message };
    }
  }

  res.status(200).json(out);
}
