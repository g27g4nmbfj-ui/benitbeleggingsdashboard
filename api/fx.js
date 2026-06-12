// Wisselkoersen via server (voorkomt CORS-fout in browser)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=EUR');
    const d = await r.json();
    if (d && d.rates) return res.status(200).json({ EUR: 1, ...d.rates });
  } catch (e) { /* fallback */ }
  // Statische fallback als de bron onbereikbaar is
  res.status(200).json({ EUR: 1, USD: 1.08, GBP: 0.85 });
}
