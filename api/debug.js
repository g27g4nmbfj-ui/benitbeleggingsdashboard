// Diagnose: test fundamentals voor meerdere tickers tegelijk
// Open: /api/debug  (test MSFT, SPGI, ADYEN.AS)  of  /api/debug?symbol=SPGI
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = process.env.FMP_API_KEY || process.env.FMP_KEY;
  if (!key) return res.status(200).json({ error: 'geen FMP key' });

  const symbols = req.query.symbol ? [req.query.symbol] : ['MSFT', 'SPGI', 'ADYEN.AS'];
  const base = 'https://financialmodelingprep.com/stable';
  const out = {};

  async function jget(url) {
    const r = await fetch(url); const t = await r.text();
    try { return { status: r.status, data: JSON.parse(t) }; }
    catch { return { status: r.status, raw: t.substring(0, 120) }; }
  }

  for (const sym of symbols) {
    const e = encodeURIComponent(sym);
    const q = await jget(`${base}/quote?symbol=${e}&apikey=${key}`);
    const r = await jget(`${base}/ratios-ttm?symbol=${e}&apikey=${key}`);
    const m = await jget(`${base}/key-metrics-ttm?symbol=${e}&apikey=${key}`);
    const est = await jget(`${base}/analyst-estimates?symbol=${e}&period=annual&page=0&limit=3&apikey=${key}`);

    const qd = Array.isArray(q.data) ? q.data[0] : q.data;
    const rd = Array.isArray(r.data) ? r.data[0] : r.data;
    const md = Array.isArray(m.data) ? m.data[0] : m.data;
    const estArr = Array.isArray(est.data) ? est.data : [];

    out[sym] = {
      quote_status: q.status,
      prijs: qd?.price ?? null,
      pe_uit_quote: qd?.pe ?? null,
      ratios_status: r.status,
      peTTM: rd?.priceToEarningsRatioTTM ?? null,
      pegTTM: rd?.priceToEarningsGrowthRatioTTM ?? null,
      opMarginTTM: rd?.operatingProfitMarginTTM ?? null,
      keymetrics_status: m.status,
      roeTTM: md?.returnOnEquityTTM ?? null,
      estimates_status: est.status,
      estimates: estArr.map(x => ({ date: x.date, epsAvg: x.epsAvg, fwdPE: qd?.price && x.epsAvg ? +(qd.price / x.epsAvg).toFixed(1) : null }))
    };
  }
  res.status(200).json(out);
}
