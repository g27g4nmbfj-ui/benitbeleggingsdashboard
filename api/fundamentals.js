// Fundamentals via Finnhub (ruime gratis limiet: 60 calls/min)
// Geeft trailing P/E, ROE, operating margin voor US-aandelen.
// PEG en forward P/E zijn bij Finnhub gratis vaak beperkt; Finviz-import vult dat aan in de app.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const key = process.env.FINNHUB_API_KEY || process.env.FINNHUB_KEY;
  if (!key) return res.status(200).json({ error: 'FINNHUB_KEY niet ingesteld', metric: {} });

  const round = (v, d = 1) => (v == null || isNaN(v)) ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

  const metric = { trailingPE: null, forwardPE: null, peg: null, roe: null, operatingMargin: null, price: null, beschikbaar: false };

  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${key}`);
    if (r.ok) {
      const d = await r.json();
      const m = d.metric || {};
      if (Object.keys(m).length) metric.beschikbaar = true;

      metric.trailingPE  = round(m.peTTM ?? m.peBasicExclExtraTTM ?? m.peNormalizedAnnual ?? null);
      metric.forwardPE   = round(m.forwardPE ?? m.peExclExtraTTM ?? null);
      metric.peg         = round(m.pegRatioTTM ?? m.pegRatio5Y ?? null, 2);
      metric.roe         = m.roeTTM != null ? Math.round(m.roeTTM) : (m.roeAnnual != null ? Math.round(m.roeAnnual) : null);
      metric.operatingMargin = m.operatingMarginTTM != null ? Math.round(m.operatingMarginTTM)
                             : (m.operatingMarginAnnual != null ? Math.round(m.operatingMarginAnnual) : null);
    }
  } catch (e) { /* leeg laten */ }

  res.status(200).json({ metric, bron: 'finnhub' });
}
