/**
 * Uygulama seviyesi sabitler.
 */
module.exports = {
  // costingDB "Ön Adet Parametreleri" REST API kökü (sonunda /api).
  costingDbApiUrl: (process.env.COSTING_DB_API_URL || 'https://costingdb-8538ae5b78bc.herokuapp.com/api').replace(/\/+$/, ''),

  // PLM FASHIONPLM OData tabanı (tenant, plmClient tarafından eklenir).
  fashionOdataBase: 'FASHIONPLM/odata2/api/odata2',

  // OData entity set adları.
  styleEntity: 'Style',
  colorwaysEntity: 'STYLECOLORWAYS',

  // Adet sıfırlanması gereken durum kodları / statüler.
  styleStatusInactive: 103,   // Style.Status bu değerse tüm adetler 0
  colorwayStatusActive: 1     // ColorwayStatus bu değilse ilgili colorway adedi 0
};
