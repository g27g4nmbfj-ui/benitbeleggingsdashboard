// Transactie-opslag via Vercel KV / Upstash Redis REST API — geen npm dependencies nodig
const KV_KEY = 'beleggen:transacties';

function getConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url, token };
}

async function redis(cmd) {
  const { url, token } = getConfig();
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, token } = getConfig();
  if (!url || !token) {
    return res.status(500).json({ error: 'KV database niet gekoppeld. Maak in Vercel een Upstash Redis database aan via Storage.' });
  }

  try {
    if (req.method === 'GET') {
      const d = await redis(['GET', KV_KEY]);
      const data = d.result ? JSON.parse(d.result) : [];
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { transacties } = req.body;
      if (!Array.isArray(transacties)) {
        return res.status(400).json({ error: 'transacties must be array' });
      }
      await redis(['SET', KV_KEY, JSON.stringify(transacties)]);
      return res.status(200).json({ ok: true, count: transacties.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
