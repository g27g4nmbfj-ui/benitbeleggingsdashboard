// Fundamentals via Financial Modeling Prep (FMP) — gratis tier 250 calls/dag
// Geeft: trailing P/E, forward P/E (via quote + eps schatting), PEG, ROE, operating margin
// Werkt voor US (MSFT) én EU aandelen (ADYEN.AS, WKL.AS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const key = process.env.FMP_API_KEY || process.env.FMP_KEY;
  if (!key) return res.status(200).json({ error: 'FMP_API_KEY niet ingesteld', metric: {} });

  const base = 'https://financialmodelingprep.com/api/v3';

  try {
    const [quoteR, ratiosR, metricsR] = await Promise.all([
      fetch(`${base}/quote/${encodeURIComponent(symbol)}?apikey=${key}`),
      fetch(`${base}/ratios-ttm/${encodeURIComponent(symbol)}?apikey=${key}`),
      fetch(`${base}/key-metrics-ttm/${encodeURIComponent(symbol)}?apikey=${key}`)
    ]);

    const quote = await quoteR.json();
    const ratios = await ratiosR.json();
    const metrics = await metricsR.json();

    const q = Array.isArray(quote) ? quote[0] : null;
    const r = Array.isArray(ratios) ? ratios[0] : null;
    const m = Array.isArray(metrics) ? metrics[0] : null;

    // Forward P/E: prijs / forward EPS. FMP quote heeft 'eps' (ttm) en soms forward.
    // Trailing P/E direct uit quote.pe
    const trailingPE = q && q.pe != null ? q.pe : (r && r.priceEarningsRatioTTM) || null;
    const forwardPE = q && q.price && q.epsForward ? q.price / q.epsForward : null;

    const metric = {
      trailingPE: trailingPE != null ? round(trailingPE) : null,
      forwardPE: forwardPE != null ? round(forwardPE) : null,
      peg: m && m.pegRatioTTM != null ? round(m.pegRatioTTM, 2)
         : (r && r.priceEarningsToGrowthRatioTTM != null ? round(r.priceEarningsToGrowthRatioTTM, 2) : null),
      roe: r && r.returnOnEquityTTM != null ? Math.round(r.returnOnEquityTTM * 100) : null,
      operatingMargin: r && r.operatingProfitMarginTTM != null ? Math.round(r.operatingProfitMarginTTM * 100) : null,
      price: q ? q.price : null,
      currency: null
    };

    res.status(200).json({ metric, bron: 'fmp' });
  } catch (e) {
    res.status(200).json({ error: e.message, metric: {} });
  }
}

function round(v, d = 1) {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}
