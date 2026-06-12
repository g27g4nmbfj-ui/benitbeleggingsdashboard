// Koersen: Finnhub eerst (US aandelen), Yahoo Finance fallback (EU aandelen zoals ADYEN.AS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const key = process.env.FINNHUB_API_KEY || process.env.FINNHUB_KEY;

  // 1. Probeer Finnhub (alleen US aandelen op gratis tier)
  if (key && !symbol.includes('.')) {
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`);
      const d = await r.json();
      if (d && d.c) {
        return res.status(200).json({ c: d.c, currency: 'USD', bron: 'finnhub' });
      }
    } catch (e) { /* val door naar Yahoo */ }
  }

  // 2. Yahoo Finance fallback (werkt voor ADYEN.AS, EBUS.AS, etc.)
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

  return res.status(200).json({ c: 0, currency: null, error: 'geen koers gevonden' });
}
