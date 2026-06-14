// Fundamentals via Finnhub. PEG wordt zelf berekend (indicatief) uit forward P/E ÷ EPS-groei.
// LET OP: zelf-berekende PEG is een schatting, kan afwijken van Finviz. Finviz-plak in de app overschrijft.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const round = (v, d = 1) => (v == null || isNaN(v)) ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const metric = {
    trailingPE: null, forwardPE: null, peg: null, pegGeschat: false,
    roe: null, operatingMargin: null, price: null, beschikbaar: false
  };

  const finnKey = process.env.FINNHUB_API_KEY || process.env.FINNHUB_KEY;
  if (!finnKey) return res.status(200).json({ error: 'FINNHUB_KEY niet ingesteld', metric });

  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${finnKey}`);
    if (r.ok) {
      const d = await r.json();
      const m = d.metric || {};
      if (Object.keys(m).length) metric.beschikbaar = true;

      metric.trailingPE = round(m.peTTM ?? m.peBasicExclExtraTTM ?? m.peNormalizedAnnual ?? null);
      metric.forwardPE  = round(m.forwardPE ?? null);
      metric.roe        = m.roeTTM != null ? Math.round(m.roeTTM) : (m.roeAnnual != null ? Math.round(m.roeAnnual) : null);
      metric.operatingMargin = m.operatingMarginTTM != null ? Math.round(m.operatingMarginTTM)
                             : (m.operatingMarginAnnual != null ? Math.round(m.operatingMarginAnnual) : null);

      // PEG: eerst Finnhub's eigen veld proberen (zelden gevuld)
      let peg = m.pegRatioTTM ?? m.pegRatio5Y ?? null;

      // Anders zelf berekenen: (forward of trailing P/E) ÷ verwachte EPS-groei%
      if (peg == null) {
        const pe = metric.forwardPE ?? metric.trailingPE;
        // Groei-bronnen in voorkeursvolgorde (Finviz gebruikt ~5jr verwachte groei)
        const groei = pickGroei([
          m.epsGrowth5Y,            // 5-jaars historische EPS-groei %
          m.epsGrowth3Y,            // 3-jaars
          m.epsGrowthTTMYoy,        // TTM jaar-op-jaar
          m.epsGrowthQuarterlyYoy   // kwartaal jaar-op-jaar
        ]);
        if (pe != null && groei != null && groei >= 5 && groei <= 100) {
          // alleen berekenen bij plausibele groei (5-100%) om onzin te vermijden
          peg = round(pe / groei, 2);
          metric.pegGeschat = true;
        }
      } else {
        peg = round(peg, 2);
      }
      metric.peg = peg;
    }
  } catch (e) { /* leeg laten */ }

  res.status(200).json({ metric, bron: 'finnhub' });
}

// Kies eerste plausibele groeiwaarde (positief getal)
function pickGroei(kandidaten) {
  for (const g of kandidaten) {
    if (g != null && !isNaN(g) && g > 0) return g;
  }
  return null;
}
