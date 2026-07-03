const styleService = require('./styleService');
const themeService = require('./themeService');
const parameterClient = require('./parameterClient');
const APP = require('../config/app.config');

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function avgAdet(rows) {
  if (!rows.length) return null;
  const sum = rows.reduce((acc, r) => acc + Number(r.adet || 0), 0);
  return Math.round(sum / rows.length);
}

/**
 * Kademeli adet çözümü.
 * L1: Alt Kategori (ProductSubSubCategory) tam eşleşmesi.
 * L2: Kategori (SubCategory) seviyesinde ortalama.
 * L3: Bölüm seviyesinde (kategori/alt kategori bağımsız) ortalama.
 * Marka + Bölüm + Sezon + Cluster + LifeStyle + Alt Sezon her seviyede sabittir.
 */
async function resolveQuantity(dims) {
  const rows = await parameterClient.fetchCandidates({
    markaId: dims.brandId,
    bolumId: dims.divisionId,
    sezonId: dims.seasonId,
    clusterCode: dims.cluster,
    lifestyleGrupId: dims.lifestyle,
    altSezonCode: dims.altSezon
  });

  if (!rows.length) {
    return { adet: null, level: null, matchCount: 0 };
  }

  const l1 = rows.filter((r) => toNum(r.alt_kategori_id) === toNum(dims.productSubSubCategoryId));
  if (l1.length) return { adet: avgAdet(l1), level: 'L1-alt_kategori', matchCount: l1.length };

  const l2 = rows.filter((r) => toNum(r.kategori_id) === toNum(dims.subCategoryId));
  if (l2.length) return { adet: avgAdet(l2), level: 'L2-kategori', matchCount: l2.length };

  return { adet: avgAdet(rows), level: 'L3-bolum', matchCount: rows.length };
}

/**
 * Bir Style için ön adet ataması yapar.
 * @param {number|string} styleId
 * @param {object} opts { dryRun } — dryRun true ise PLM'e yazılmaz, sadece hesap döner.
 */
async function assignPreQuantity(styleId, opts = {}) {
  const dryRun = !!opts.dryRun;

  const style = await styleService.fetchStyle(styleId);
  if (!style) {
    const e = new Error(`Style bulunamadı: ${styleId}`);
    e.statusCode = 404;
    throw e;
  }

  const forcedZero = Number(style.Status) === APP.styleStatusInactive;
  const base = {
    brandId: style.BrandId,
    divisionId: style.DivisionId,
    subCategoryId: style.SubCategoryId,
    productSubSubCategoryId: style.ProductSubSubCategoryId,
    seasonId: style.SeasonId
  };

  const colorways = styleService.getColorways(style);
  const results = [];

  // ION script'iyle birebir: style seviyesinde iki bayrak.
  let hasValidationError = false; // herhangi bir renkte hesaplanamama/0/eksik boyut
  let hasChange = false;          // herhangi bir renkte currentQty != newQty

  for (const cw of colorways) {
    const styleColorwayId = cw.StyleColorwayId;
    const currentQty = Number(cw.MinimumQuantity || 0);
    const colorwayStatus = Number(cw.ColorwayStatus);
    const lifestyle = cw.ColorwayUserField4;
    const themePid = (cw.Theme && cw.Theme.Description) || '';

    // Script'te calculated_minimum_qty varsayılan 0'dır.
    const entry = {
      styleColorwayId,
      currentQty,
      colorwayStatus,
      lifestyle,
      cluster: '',
      altSezon: '',
      newQty: 0,
      changed: false,
      level: null,
      note: null,
      error: null
    };

    if (forcedZero || colorwayStatus !== APP.colorwayStatusActive) {
      // İptal/sıfırlama: adet 0, ama VALIDASYON HATASI DEĞİL (geçerli sıfırlama).
      entry.newQty = 0;
      entry.note = forcedZero
        ? `Style.Status=${APP.styleStatusInactive} → adet 0`
        : `ColorwayStatus=${colorwayStatus} (aktif değil) → adet 0`;
    } else {
      // Tema özniteliklerini (Cluster, Alt_Sezon) çöz
      try {
        const theme = await themeService.resolveThemeAttributes(themePid);
        entry.cluster = theme.cluster;
        entry.altSezon = theme.altSezon;
      } catch (err) {
        entry.error = `Tema öznitelikleri okunamadı (${themePid}): ${err.message}`;
        hasValidationError = true;
      }

      if (!entry.error) {
        // Validasyon: cluster / altSezon / lifestyle boş mu? (script: cluster/hibrit/lifestyle)
        if (!entry.cluster || !entry.altSezon || lifestyle === null || lifestyle === undefined || lifestyle === '') {
          entry.error = `Eksik boyut — cluster="${entry.cluster}", altSezon="${entry.altSezon}", lifestyle="${lifestyle}"`;
          hasValidationError = true;
        } else {
          try {
            const res = await resolveQuantity({ ...base, cluster: entry.cluster, altSezon: entry.altSezon, lifestyle });
            // Script kuralı: eşleşme yoksa VEYA hesaplanan adet 0 ise → validasyon hatası.
            if (res.adet === null || res.adet === 0) {
              entry.newQty = 0;
              entry.error = res.adet === null
                ? 'Ön Adet Parametreleri tablosunda eşleşen kayıt bulunamadı (L1/L2/L3).'
                : 'Eşleşen adet 0 — validasyon hatası (script kuralı).';
              hasValidationError = true;
            } else {
              entry.newQty = res.adet;
              entry.level = res.level;
              entry.note = `${res.level} (${res.matchCount} kayıt)`;
            }
          } catch (err) {
            entry.error = `Parametre sorgusu hatası: ${err.message}`;
            hasValidationError = true;
          }
        }
      }
    }

    // Değişiklik tespiti (script: input_qty_safe != calculated_minimum_qty)
    const inputQtySafe = Number.isFinite(currentQty) ? Math.trunc(currentQty) : 0;
    entry.changed = inputQtySafe !== entry.newQty;
    if (entry.changed) hasChange = true;

    results.push(entry);
  }

  // Filter (script): 000 = hata VEYA değişiklik yok → hiç patch yok. 001 = başarılı + değişiklik var.
  const filter = (hasValidationError || !hasChange) ? '000' : '001';
  const willPatch = filter === '001';

  // ScriptQty: TÜM renklerin hesaplanan adedinin toplamı (script ile birebir).
  const scriptQty = results.reduce((acc, r) => acc + Number(r.newQty || 0), 0);

  // PatchColor: yalnızca DEĞİŞEN renkler (currentQty != newQty). Değişmeyen renge
  // boşuna patch atmıyoruz; PLM'deki son durum yine aynı olur.
  const patchArray = results
    .filter((r) => r.changed)
    .map((r) => ({ StyleColorwayId: r.styleColorwayId, MinimumQuantity: r.newQty }));

  const errors = results.filter((r) => r.error).map((r) => ({ styleColorwayId: r.styleColorwayId, error: r.error }));

  let patched = { colorways: 0, styleTotal: false };
  if (!dryRun && willPatch && patchArray.length) {
    await styleService.patchColorways(patchArray);
    await styleService.patchStyleTotal(styleId, scriptQty);
    patched = { colorways: patchArray.length, styleTotal: true };
  }

  return {
    styleId: style.StyleId,
    styleCode: style.StyleCode,
    status: style.Status,
    forcedZero,
    dimensions: base,
    filter,
    hasValidationError,
    hasChange,
    totalQty: scriptQty,
    colorways: results,
    errors,
    patched,
    dryRun
  };
}

module.exports = { assignPreQuantity, resolveQuantity };
