// Cloud-opslag via Upstash Redis (REST).
// Backward compatible:
//   GET  /api/kv                 → geeft transacties-array terug (oud gedrag)
//   POST /api/kv {transacties}   → slaat transacties op (oud gedrag)
// Uitgebreid met losse sleutels voor sync tussen apparaten:
//   GET  /api/kv?key=watchlist   → geeft opgeslagen waarde voor die sleutel
//   POST /api/kv {key, value}    → slaat waarde onder die sleutel op
const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

// Toegestane sleutels (voorkomt willekeurige opslag)
const KEYS = {
  transacties: 'benit_transacties',
  watchlist:   'benit_watchlist',
  acties:      'benit_acties',
  notities:    'benit_notities',
  finviz:      'benit_finviz'
};

async function redisGet(redisKey) {
  const r = await fetch(`${BASE}/get/${encodeURIComponent(redisKey)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  if (!r.ok) throw new Error('redis get ' + r.status);
  const d = await r.json();
  if (d.result == null) return null;
  try { return JSON.parse(d.result); } catch (_) { return null; }
}

async function redisSet(redisKey, value) {
  const r = await fetch(`${BASE}/set/${encodeURIComponent(redisKey)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!r.ok) throw new Error('redis set ' + r.status);
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!BASE || !TOKEN) return res.status(500).json({ error: 'KV niet ingesteld' });

  try {
    if (req.method === 'GET') {
      const key = req.query.key;
      if (key && KEYS[key]) {
        // Nieuwe modus: losse sleutel
        const val = await redisGet(KEYS[key]);
        return res.status(200).json(val);
      }
      // Oud gedrag: transacties-array
      const tr = await redisGet(KEYS.transacties);
      return res.status(200).json(Array.isArray(tr) ? tr : []);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      // Nieuwe modus: {key, value}
      if (body.key && KEYS[body.key]) {
        await redisSet(KEYS[body.key], body.value ?? null);
        return res.status(200).json({ ok: true });
      }
      // Oud gedrag: {transacties}
      if (body.transacties !== undefined) {
        await redisSet(KEYS.transacties, body.transacties);
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'geen geldige key of transacties' });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
}
