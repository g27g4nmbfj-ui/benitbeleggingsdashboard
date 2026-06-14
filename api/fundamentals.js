// Fundamentals: Finnhub (P/E, ROE, margin) + Yahoo quoteSummary (PEG, forward P/E)
// Yahoo's defaultKeyStatistics.pegRatio is de bron die eerder de PEG leverde.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const round = (v, d = 1) => (v == null || isNaN(v)) ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

  const metric = { trailingPE: null, forwardPE: null, peg: null, roe: null, operatingMargin: null, price: null, beschikbaar: false };

  // ─── 1. Finnhub: P/E, ROE, operating margin (betrouwbaar) ───
  const finnKey = process.env.FINNHUB_API_KEY || process.env.FINNHUB_KEY;
  if (finnKey) {
    try {
      const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${finnKey}`);
      if (r.ok) {
        const d = await r.json();
        const m = d.metric || {};
        if (Object.keys(m).length) metric.beschikbaar = true;
        metric.trailingPE  = round(m.peTTM ?? m.peBasicExclExtraTTM ?? m.peNormalizedAnnual ?? null);
        metric.forwardPE   = round(m.forwardPE ?? null);
        metric.peg         = round(m.pegRatioTTM ?? m.pegRatio5Y ?? null, 2);
        metric.roe         = m.roeTTM != null ? Math.round(m.roeTTM) : (m.roeAnnual != null ? Math.round(m.roeAnnual) : null);
        metric.operatingMargin = m.operatingMarginTTM != null ? Math.round(m.operatingMarginTTM)
                               : (m.operatingMarginAnnual != null ? Math.round(m.operatingMarginAnnual) : null);
      }
    } catch (e) { /* door naar Yahoo */ }
  }

  // ─── 2. Yahoo quoteSummary: PEG + forward P/E (vult Finnhub-gaten) ───
  // Werkt voor US én EU (ADYEN.AS). Publieke endpoint, geen key nodig.
  if (metric.peg == null || metric.forwardPE == null || metric.trailingPE == null) {
    try {
      const modules = 'defaultKeyStatistics,financialData,summaryDetail';
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      if (r.ok) {
        const d = await r.json();
        const res0 = d?.quoteSummary?.result?.[0] || {};
        const ks = res0.defaultKeyStatistics || {};
        const sd = res0.summaryDetail || {};
        const fd = res0.financialData || {};

        metric.beschikbaar = true;
        if (metric.peg == null) metric.peg = round(ks.pegRatio?.raw ?? null, 2);
        if (metric.forwardPE == null) metric.forwardPE = round(ks.forwardPE?.raw ?? sd.forwardPE?.raw ?? null);
        if (metric.trailingPE == null) metric.trailingPE = round(sd.trailingPE?.raw ?? ks.trailingPE?.raw ?? null);
        if (metric.roe == null && fd.returnOnEquity?.raw != null) metric.roe = Math.round(fd.returnOnEquity.raw * 100);
        if (metric.operatingMargin == null && fd.operatingMargins?.raw != null) metric.operatingMargin = Math.round(fd.operatingMargins.raw * 100);
        if (metric.price == null) metric.price = fd.currentPrice?.raw ?? sd.regularMarketPrice?.raw ?? null;
      }
    } catch (e) { /* leeg laten */ }
  }

  res.status(200).json({ metric, bron: 'finnhub+yahoo' });
}
