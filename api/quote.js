// Koers: Finnhub eerst (US, ruime limiet), Yahoo chart fallback (EU zoals ADYEN.AS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const finnKey = process.env.FINNHUB_API_KEY || process.env.FINNHUB_KEY;

  // 1. Finnhub (alleen US tickers, geen suffix)
  if (finnKey && !symbol.includes('.')) {
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${finnKey}`);
      const d = await r.json();
      if (d && d.c) return res.status(200).json({ c: d.c, currency: 'USD', bron: 'finnhub' });
    } catch (e) { /* door */ }
  }

  // 2. Yahoo chart fallback (US + EU, geen key nodig)
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
