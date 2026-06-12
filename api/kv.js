import { kv } from '@vercel/kv';

const KV_KEY = 'beleggen:transacties';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const data = await kv.get(KV_KEY);
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { transacties } = req.body;
      if (!Array.isArray(transacties)) {
        return res.status(400).json({ error: 'transacties must be array' });
      }
      await kv.set(KV_KEY, transacties);
      return res.status(200).json({ ok: true, count: transacties.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
