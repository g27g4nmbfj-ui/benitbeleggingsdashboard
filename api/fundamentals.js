// Fundamentals via FMP — probeert meerdere endpoints zodat het werkt
// op zowel het oude (/api/v3/) als nieuwe (/stable/) FMP-plan.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const key = process.env.FMP_API_KEY || process.env.FMP_KEY;
  if (!key) return res.status(200).json({ error: 'FMP_API_KEY niet ingesteld', metric: {} });

  const round = (v, d = 1) => v == null || isNaN(v) ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const pct = (v) => v == null || isNaN(v) ? null : Math.round(v * 100);

  const metric = { trailingPE: null, forwardPE: null, peg: null, roe: null, operatingMargin: null, price: null };

  async function jget(url) {
    try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); }
    catch { return null; }
  }

  // ── 1. QUOTE (prijs, trailing P/E, eps) ──
  // Probeer eerst stable, dan v3
  let q = await jget(`https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(symbol)}&apikey=${key}`);
  if (Array.isArray(q)) q = q[0];
  if (!q || !q.price) {
    let q2 = await jget(`https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(symbol)}?apikey=${key}`);
    if (Array.isArray(q2)) q2 = q2[0];
    if (q2) q = q2;
  }
  if (q) {
    metric.price = q.price ?? null;
    metric.trailingPE = round(q.pe ?? null);
    if (q.price && q.epsForward) metric.forwardPE = round(q.price / q.epsForward);
  }

  // ── 2. RATIOS TTM (PEG, ROE, operating margin) ──
  let r = await jget(`https://financialmodelingprep.com/stable/ratios-ttm?symbol=${encodeURIComponent(symbol)}&apikey=${key}`);
  if (Array.isArray(r)) r = r[0];
  if (!r) {
    let r2 = await jget(`https://financialmodelingprep.com/api/v3/ratios-ttm/${encodeURIComponent(symbol)}?apikey=${key}`);
    if (Array.isArray(r2)) r2 = r2[0];
    if (r2) r = r2;
  }
  if (r) {
    // veldnamen verschillen tussen stable/v3
    const roe = r.returnOnEquityTTM ?? r.returnOnEquity ?? null;
    const opm = r.operatingProfitMarginTTM ?? r.operatingProfitMargin ?? r.operatingMarginTTM ?? null;
    const peg = r.priceEarningsToGrowthRatioTTM ?? r.pegRatioTTM ?? r.priceToEarningsGrowthRatioTTM ?? null;
    metric.roe = pct(roe);
    metric.operatingMargin = pct(opm);
    if (peg != null) metric.peg = round(peg, 2);
  }

  // ── 3. KEY METRICS TTM (fallback voor PEG) ──
  if (metric.peg == null) {
    let m = await jget(`https://financialmodelingprep.com/stable/key-metrics-ttm?symbol=${encodeURIComponent(symbol)}&apikey=${key}`);
    if (Array.isArray(m)) m = m[0];
    if (!m) {
      let m2 = await jget(`https://financialmodelingprep.com/api/v3/key-metrics-ttm/${encodeURIComponent(symbol)}?apikey=${key}`);
      if (Array.isArray(m2)) m2 = m2[0];
      if (m2) m = m2;
    }
    if (m) {
      const peg = m.pegRatioTTM ?? m.priceToEarningsGrowthRatioTTM ?? null;
      if (peg != null) metric.peg = round(peg, 2);
    }
  }

  res.status(200).json({ metric, bron: 'fmp' });
}
