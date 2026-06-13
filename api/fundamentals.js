// Fundamentals via FMP STABLE API — veldnamen geverifieerd tegen live data
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const key = process.env.FMP_API_KEY || process.env.FMP_KEY;
  if (!key) return res.status(200).json({ error: 'FMP_API_KEY niet ingesteld', metric: {} });

  const round = (v, d = 1) => (v == null || isNaN(v)) ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const pct = (v) => (v == null || isNaN(v)) ? null : Math.round(v * 100);

  const metric = { trailingPE: null, forwardPE: null, peg: null, roe: null, operatingMargin: null, roic: null, price: null };

  async function jget(url) {
    try { const r = await fetch(url); if (!r.ok) return null; const d = await r.json(); return Array.isArray(d) ? d[0] : d; }
    catch { return null; }
  }
  const base = 'https://financialmodelingprep.com/stable';
  const sym = encodeURIComponent(symbol);

  // 1. QUOTE — prijs + trailing P/E (uit quote.pe)
  const q = await jget(`${base}/quote?symbol=${sym}&apikey=${key}`);
  if (q) {
    metric.price = q.price ?? null;
    if (q.pe != null) metric.trailingPE = round(q.pe);
    if (q.eps && q.price && metric.trailingPE == null) metric.trailingPE = round(q.price / q.eps);
  }

  // 2. RATIOS TTM — trailing P/E, PEG, operating margin
  const r = await jget(`${base}/ratios-ttm?symbol=${sym}&apikey=${key}`);
  if (r) {
    if (metric.trailingPE == null && r.priceToEarningsRatioTTM != null) metric.trailingPE = round(r.priceToEarningsRatioTTM);
    // PEG: voorkeur voor priceToEarningsGrowthRatioTTM, anders forward variant
    const peg = r.priceToEarningsGrowthRatioTTM ?? r.forwardPriceToEarningsGrowthRatioTTM ?? null;
    if (peg != null) metric.peg = round(peg, 2);
    if (r.operatingProfitMarginTTM != null) metric.operatingMargin = pct(r.operatingProfitMarginTTM);
    if (r.returnOnEquityTTM != null) metric.roe = pct(r.returnOnEquityTTM);
  }

  // 3. KEY METRICS TTM — ROE, ROIC (betrouwbaarder dan ratios)
  const m = await jget(`${base}/key-metrics-ttm?symbol=${sym}&apikey=${key}`);
  if (m) {
    if (m.returnOnEquityTTM != null) metric.roe = pct(m.returnOnEquityTTM);
    if (m.returnOnInvestedCapitalTTM != null) metric.roic = pct(m.returnOnInvestedCapitalTTM);
  }

  // 4. FORWARD P/E — analyst estimates, eerstvolgend boekjaar (zoals Finviz)
  const est = await jget(`${base}/analyst-estimates?symbol=${sym}&period=annual&page=0&limit=5&apikey=${key}`);
  if (Array.isArray(est) && metric.price) {
    const nu = new Date();
    const toekomst = est
      .filter(e => e.epsAvg && e.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .find(e => new Date(e.date) > nu);
    const gekozen = toekomst || est.find(e => e.epsAvg);
    if (gekozen && gekozen.epsAvg > 0) {
      metric.forwardPE = round(metric.price / gekozen.epsAvg);
    }
  } else if (est && est.epsAvg && metric.price) {
    metric.forwardPE = round(metric.price / est.epsAvg);
  }

  res.status(200).json({ metric, bron: 'fmp-stable' });
}
