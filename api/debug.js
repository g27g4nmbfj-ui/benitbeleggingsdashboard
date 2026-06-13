// Diagnose forward P/E: bekijk analyst-estimates ruw voor MSFT
// Finviz fwd P/E voor MSFT = 20.09, prijs ~390 → impliceert forward EPS ~19.4
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const symbol = req.query.symbol || 'MSFT';
  const key = process.env.FMP_API_KEY || process.env.FMP_KEY;
  if (!key) return res.status(200).json({ error: 'geen key' });

  const out = { symbol };
  async function jget(url) {
    const r = await fetch(url); const t = await r.text();
    try { return { status: r.status, data: JSON.parse(t) }; } catch { return { status: r.status, raw: t.substring(0,150) }; }
  }
  const base = 'https://financialmodelingprep.com/stable';
  const sym = encodeURIComponent(symbol);

  const q = await jget(`${base}/quote?symbol=${sym}&apikey=${key}`);
  out.prijs = Array.isArray(q.data) ? q.data[0]?.price : null;
  out.eps_ttm = Array.isArray(q.data) ? q.data[0]?.eps : null;

  // Analyst estimates — meerdere jaren, toon eps velden
  const est = await jget(`${base}/analyst-estimates?symbol=${sym}&period=annual&page=0&limit=5&apikey=${key}`);
  out.estimates_status = est.status;
  if (Array.isArray(est.data)) {
    out.estimates = est.data.map(e => ({
      datum: e.date,
      epsAvg: e.epsAvg, epsLow: e.epsLow, epsHigh: e.epsHigh,
      fwdPE_als_dit_klopt: out.prijs && e.epsAvg ? +(out.prijs / e.epsAvg).toFixed(1) : null
    }));
  } else {
    out.estimates_raw = est;
  }
  res.status(200).json(out);
}
