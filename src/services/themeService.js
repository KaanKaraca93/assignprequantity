const plmClient = require('./plmClient');

/**
 * Tema PID'sinden (STYLECOLORWAYS.Theme.Description, örn "Theme_Attributes-403-0-LATEST")
 * IDM item'ı okuyup Cluster ve Alt_Sezon özniteliklerini döner.
 * Aynı tema birden fazla colorway tarafından paylaşıldığı için PID bazında cache'lenir.
 */
const TTL_MS = 30 * 60 * 1000; // 30 dk — tema meta verisi nadiren değişir
const cache = {};

async function resolveThemeAttributes(themePid) {
  if (!themePid) return { cluster: '', altSezon: '' };

  const cached = cache[themePid];
  if (cached && (Date.now() - cached.loadedAt) < TTL_MS) {
    return cached.value;
  }

  const resp = await plmClient.get(`/IDM/api/items/${themePid}`);
  const attrs = (resp && resp.item && resp.item.attrs && resp.item.attrs.attr) || [];

  const findVal = (name) => {
    const a = attrs.find((x) => x.name === name || x.qual === name);
    return a && a.value != null ? String(a.value) : '';
  };

  const value = {
    cluster: findVal('Cluster'),
    altSezon: findVal('Alt_Sezon')
  };
  cache[themePid] = { value, loadedAt: Date.now() };
  return value;
}

module.exports = { resolveThemeAttributes };
