// Test of Yahoo quoteSummary werkt op Vercel (PEG-bron)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const symbol = req.query.symbol || 'MSFT';
  const out = { symbol, tests: {} };

  // Test A: directe quoteSummary
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=defaultKeyStatistics,summaryDetail,financialData`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const tekst = await r.text();
    let peg = null, fpe = null;
    try {
      const d = JSON.parse(tekst);
      const res0 = d?.quoteSummary?.result?.[0] || {};
      peg = res0.defaultKeyStatistics?.pegRatio?.raw ?? null;
      fpe = res0.defaultKeyStatistics?.forwardPE?.raw ?? null;
    } catch {}
    out.tests.query1 = { status: r.status, peg, forwardPE: fpe, preview: tekst.substring(0, 120) };
  } catch (e) { out.tests.query1 = { fout: e.message }; }

  // Test B: query2 variant
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=defaultKeyStatistics`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const tekst = await r.text();
    let peg = null;
    try { peg = JSON.parse(tekst)?.quoteSummary?.result?.[0]?.defaultKeyStatistics?.pegRatio?.raw ?? null; } catch {}
    out.tests.query2 = { status: r.status, peg };
  } catch (e) { out.tests.query2 = { fout: e.message }; }

  res.status(200).json(out);
}
