// Koers: FMP eerst (US + EU), dan Finnhub (US), dan Yahoo chart (fallback)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const fmpKey = process.env.FMP_API_KEY || process.env.FMP_KEY;
  const finnKey = process.env.FINNHUB_API_KEY || process.env.FINNHUB_KEY;

  // 1. FMP quote (werkt voor US én EU zoals ADYEN.AS)
  if (fmpKey) {
    try {
      const r = await fetch(`https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(symbol)}?apikey=${fmpKey}`);
      const d = await r.json();
      if (Array.isArray(d) && d[0] && d[0].price) {
        const valuta = symbol.includes('.AS') ? 'EUR' : symbol.includes('.L') ? 'GBP' : 'USD';
        return res.status(200).json({ c: d[0].price, currency: valuta, bron: 'fmp' });
      }
    } catch (e) { /* door */ }
  }

  // 2. Finnhub (alleen US)
  if (finnKey && !symbol.includes('.')) {
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${finnKey}`);
      const d = await r.json();
      if (d && d.c) return res.status(200).json({ c: d.c, currency: 'USD', bron: 'finnhub' });
    } catch (e) { /* door */ }
  }

  // 3. Yahoo chart fallback
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const d = await r.json();
    const meta = d?.chart?.result?.[0]?.meta;
    if (meta && meta.regularMarketPrice) {
      return res.status(200).json({ c: meta.regularMarketPrice, currency: meta.currency || 'USD', bron: 'yahoo' });
    }
  } catch (e) { /* niks */ }

  return res.status(200).json({ c: 0, currency: null, error: 'geen koers' });
}
