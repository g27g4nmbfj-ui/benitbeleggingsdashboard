// Diagnose: test welke stable endpoints forward P/E geven
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const symbol = req.query.symbol || 'MSFT';
  const key = process.env.FMP_API_KEY || process.env.FMP_KEY;
  const out = { symbol, keyAanwezig: !!key, resultaten: {} };
  if (!key) return res.status(200).json(out);

  const endpoints = {
    analyst_estimates: `https://financialmodelingprep.com/stable/analyst-estimates?symbol=${symbol}&period=annual&limit=1&apikey=${key}`,
    ratios_snapshot:   `https://financialmodelingprep.com/stable/ratios?symbol=${symbol}&limit=1&apikey=${key}`,
    grade:             `https://financialmodelingprep.com/stable/grades-consensus?symbol=${symbol}&apikey=${key}`
  };
  for (const [naam, url] of Object.entries(endpoints)) {
    try {
      const r = await fetch(url);
      const t = await r.text();
      let data; try { data = JSON.parse(t); } catch { data = t.substring(0, 150); }
      out.resultaten[naam] = { status: r.status, data: Array.isArray(data) ? data[0] : data };
    } catch (e) { out.resultaten[naam] = { fout: e.message }; }
  }
  res.status(200).json(out);
}
