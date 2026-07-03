const plmClient = require('./plmClient');
const APP = require('../config/app.config');

const ODATA = APP.fashionOdataBase;

/**
 * Bir Style'ı (ve StyleColorways + Theme'lerini) PLM'den çeker.
 * Ön adet hesabı için gereken tüm alanları select/expand eder.
 */
async function fetchStyle(styleId) {
  const params = {
    $filter: `StyleId eq ${styleId}`,
    $select: 'StyleId,StyleCode,Status,BrandId,DivisionId,SubCategoryId,ProductSubSubCategoryId,SeasonId,NumericValue1',
    $expand: 'StyleColorways($select=StyleColorwayId,MinimumQuantity,ColorwayUserField4,ColorwayStatus;$expand=Theme($select=Id,Description))'
  };
  const data = await plmClient.get(`/${ODATA}/${APP.styleEntity}`, params);
  const list = (data && data.value) || [];
  return list[0] || null;
}

/**
 * Colorway'lerin MinimumQuantity değerlerini toplu PATCH'ler.
 * ION flow'undaki "PatchColor" adımıyla aynı: gövde, her biri StyleColorwayId
 * + MinimumQuantity taşıyan bir dizidir.
 */
async function patchColorways(patchArray) {
  if (!patchArray || patchArray.length === 0) return null;
  return plmClient.patch(`/${ODATA}/${APP.colorwaysEntity}`, patchArray);
}

/**
 * Style seviyesinde toplam adedi NumericValue1 alanına yazar.
 */
async function patchStyleTotal(styleId, total) {
  return plmClient.patch(`/${ODATA}/${APP.styleEntity}(${styleId})`, { NumericValue1: total });
}

function getColorways(style) {
  return (style && (style.StyleColorways || style.STYLECOLORWAYS)) || [];
}

module.exports = { fetchStyle, patchColorways, patchStyleTotal, getColorways };
