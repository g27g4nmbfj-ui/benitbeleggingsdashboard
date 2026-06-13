// Fundamentals via FMP STABLE API
// Forward P/E + PEG worden zelf berekend uit analyst-estimates (dichter bij Finviz dan FMP's eigen velden)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const key = process.env.FMP_API_KEY || process.env.FMP_KEY;
  if (!key) return res.status(200).json({ error: 'FMP_API_KEY niet ingesteld', metric: {} });

  const round = (v, d = 1) => (v == null || isNaN(v)) ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const pct = (v) => (v == null || isNaN(v)) ? null : Math.round(v * 100);

  const metric = { trailingPE: null, forwardPE: null, peg: null, roe: null, operatingMargin: null, roic: null, price: null, beschikbaar: false };

  async function jget(url) {
    try { const r = await fetch(url); if (!r.ok) return { _status: r.status }; const d = await r.json(); return Array.isArray(d) ? (d[0] || {}) : d; }
    catch { return null; }
  }
  const base = 'https://financialmodelingprep.com/stable';
  const sym = encodeURIComponent(symbol);

  // 1. QUOTE — prijs + trailing P/E
  const q = await jget(`${base}/quote?symbol=${sym}&apikey=${key}`);
  if (q && !q._status) {
    metric.beschikbaar = true;
    metric.price = q.price ?? null;
    if (q.pe != null) metric.trailingPE = round(q.pe);
    if (q.eps && q.price && metric.trailingPE == null) metric.trailingPE = round(q.price / q.eps);
  }

  // 2. RATIOS TTM — trailing P/E fallback, operating margin
  const r = await jget(`${base}/ratios-ttm?symbol=${sym}&apikey=${key}`);
  if (r && !r._status) {
    if (metric.trailingPE == null && r.priceToEarningsRatioTTM != null) metric.trailingPE = round(r.priceToEarningsRatioTTM);
    if (r.operatingProfitMarginTTM != null) metric.operatingMargin = pct(r.operatingProfitMarginTTM);
    if (r.returnOnEquityTTM != null) metric.roe = pct(r.returnOnEquityTTM);
  }

  // 3. KEY METRICS TTM — ROE, ROIC
  const m = await jget(`${base}/key-metrics-ttm?symbol=${sym}&apikey=${key}`);
  if (m && !m._status) {
    if (m.returnOnEquityTTM != null) metric.roe = pct(m.returnOnEquityTTM);
    if (m.returnOnInvestedCapitalTTM != null) metric.roic = pct(m.returnOnInvestedCapitalTTM);
  }

  // 4. ANALYST ESTIMATES — forward P/E (eerstvolgend boekjaar) + PEG (zelf berekend)
  const est = await jget(`${base}/analyst-estimates?symbol=${sym}&period=annual&page=0&limit=5&apikey=${key}`);
  // est kan een object (1 rij) of leeg zijn; haal de volledige array apart op:
  let estArr = [];
  try {
    const rr = await fetch(`${base}/analyst-estimates?symbol=${sym}&period=annual&page=0&limit=5&apikey=${key}`);
    if (rr.ok) { const d = await rr.json(); if (Array.isArray(d)) estArr = d; }
  } catch {}

  if (estArr.length && metric.price) {
    const nu = new Date();
    const toekomst = estArr
      .filter(e => e.epsAvg && e.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .filter(e => new Date(e.date) > nu);

    if (toekomst.length >= 1 && toekomst[0].epsAvg > 0) {
      // Forward P/E op eerstvolgend boekjaar
      metric.forwardPE = round(metric.price / toekomst[0].epsAvg);

      // PEG = forward P/E / verwachte EPS-groei% (jaar1 → jaar2), Finviz-stijl
      if (toekomst.length >= 2 && toekomst[1].epsAvg > 0) {
        const groei = ((toekomst[1].epsAvg - toekomst[0].epsAvg) / toekomst[0].epsAvg) * 100;
        if (groei > 0) metric.peg = round(metric.forwardPE / groei, 2);
      }
    }
  }

  res.status(200).json({ metric, bron: 'fmp-stable' });
}
