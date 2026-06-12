// Fundamentals via FMP STABLE API (de oude /api/v3/ is sinds 31-08-2025 dood)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const key = process.env.FMP_API_KEY || process.env.FMP_KEY;
  if (!key) return res.status(200).json({ error: 'FMP_API_KEY niet ingesteld', metric: {} });

  const round = (v, d = 1) => (v == null || isNaN(v)) ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const pct = (v) => (v == null || isNaN(v)) ? null : Math.round(v * 100);

  const metric = { trailingPE: null, forwardPE: null, peg: null, roe: null, operatingMargin: null, price: null };

  async function jget(url) {
    try { const r = await fetch(url); if (!r.ok) return null; const d = await r.json(); return Array.isArray(d) ? d[0] : d; }
    catch { return null; }
  }
  const base = 'https://financialmodelingprep.com/stable';
  const sym = encodeURIComponent(symbol);

  // 1. QUOTE — prijs + trailing P/E
  const q = await jget(`${base}/quote?symbol=${sym}&apikey=${key}`);
  if (q) {
    metric.price = q.price ?? null;
    metric.trailingPE = round(q.pe ?? null);
    if (q.price && q.epsForward) metric.forwardPE = round(q.price / q.epsForward);
  }

  // 2. RATIOS TTM — ROE, operating margin, (soms) PEG
  const r = await jget(`${base}/ratios-ttm?symbol=${sym}&apikey=${key}`);
  if (r) {
    const roe = r.returnOnEquityTTM ?? r.returnOnEquity ?? null;
    const opm = r.operatingProfitMarginTTM ?? r.operatingProfitMargin ?? null;
    const peg = r.priceToEarningsGrowthRatioTTM ?? r.priceEarningsToGrowthRatioTTM ?? null;
    metric.roe = pct(roe);
    metric.operatingMargin = pct(opm);
    if (peg != null) metric.peg = round(peg, 2);
  }

  // 3. KEY METRICS TTM — PEG + forward P/E fallback
  const m = await jget(`${base}/key-metrics-ttm?symbol=${sym}&apikey=${key}`);
  if (m) {
    if (metric.peg == null) {
      const peg = m.pegRatioTTM ?? m.priceToEarningsGrowthRatioTTM ?? null;
      if (peg != null) metric.peg = round(peg, 2);
    }
    if (metric.roe == null && m.returnOnEquityTTM != null) metric.roe = pct(m.returnOnEquityTTM);
    if (metric.forwardPE == null && m.forwardPE != null) metric.forwardPE = round(m.forwardPE);
  }

  res.status(200).json({ metric, bron: 'fmp-stable' });
}
