const axios = require('axios');
const APP = require('../config/app.config');

/**
 * costingDB "Ön Adet Parametreleri" REST API istemcisi.
 * Belirli bir kırılım için aday parametre satırlarını çeker; kademeli fallback
 * (L1/L2/L3) hesabı bu satırlar üzerinde bellekte yapılır.
 *
 * Verilen filtreler tüm colorway için sabit olan boyutlardır (marka, bölüm, sezon,
 * cluster, lifestyle grubu, alt sezon). Dönen satırlarda değişebilen tek boyut
 * kategori_id (SubCategory) ve alt_kategori_id (ProductSubSubCategory) olur.
 */
const TTL_MS = 60 * 1000;
const cache = {};

function buildQuery(filters) {
  const qs = [];
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue;
    qs.push(`${k}=${encodeURIComponent(v)}`);
  }
  return qs.length ? `?${qs.join('&')}` : '';
}

async function fetchCandidates(filters) {
  const key = JSON.stringify(filters);
  const hit = cache[key];
  if (hit && (Date.now() - hit.loadedAt) < TTL_MS) {
    return hit.rows;
  }

  const url = `${APP.costingDbApiUrl}/on-adet-parametreleri${buildQuery(filters)}`;
  try {
    const resp = await axios.get(url, { headers: { Accept: 'application/json' }, timeout: 20000 });
    const rows = Array.isArray(resp.data) ? resp.data : [];
    cache[key] = { rows, loadedAt: Date.now() };
    return rows;
  } catch (err) {
    const status = err.response ? err.response.status : '?';
    const detail = err.response ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`costingDB parametre sorgusu başarısız (HTTP ${status}): ${detail}`);
  }
}

module.exports = { fetchCandidates };
