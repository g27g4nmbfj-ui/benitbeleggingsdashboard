// Test welk RapidAPI Yahoo-endpoint PEG teruggeeft
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const symbol = req.query.symbol || 'MSFT';
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST || 'yahoo-finance15.p.rapidapi.com';
  if (!key) return res.status(200).json({ error: 'RAPIDAPI_KEY niet ingesteld in Vercel' });

  const out = { symbol, host, tests: {} };
  const H = { 'x-rapidapi-key': key, 'x-rapidapi-host': host };

  // Verschillende mogelijke endpoints van yahoo-finance15
  const endpoints = {
    modules_keystats: `https://${host}/api/v1/markets/stock/modules?ticker=${symbol}&module=default-key-statistics`,
    modules_financial: `https://${host}/api/v1/markets/stock/modules?ticker=${symbol}&module=financial-data`,
    quote: `https://${host}/api/v1/markets/quote?ticker=${symbol}&type=STOCKS`,
    statistics: `https://${host}/api/v1/markets/stock/statistics?ticker=${symbol}`
  };

  for (const [naam, url] of Object.entries(endpoints)) {
    try {
      const r = await fetch(url, { headers: H });
      const tekst = await r.text();
      let preview = tekst.substring(0, 300);
      // Zoek naar peg in de response
      const heeftPeg = /peg/i.test(tekst);
      out.tests[naam] = { status: r.status, heeftPeg, preview };
    } catch (e) {
      out.tests[naam] = { fout: e.message };
    }
  }
  res.status(200).json(out);
}
