# assignprequantity

PLM Style **ön adet (MinimumQuantity)** atama API'si. Eski ION'da hardcoded karar
listesiyle çalışan akışın, `costingDB` "Ön Adet Parametreleri" tablosunu kullanan
bağımsız bir servise dönüştürülmüş halidir. Ayrı repo, ayrı Heroku uygulaması.

## Akış

1. `styleId` parametre olarak gelir.
2. PLM `FASHIONPLM/odata2/api/odata2/Style` sorgulanır:
   - `$select=StyleId,StyleCode,Status,BrandId,DivisionId,SubCategoryId,ProductSubSubCategoryId,SeasonId,NumericValue1`
   - `$expand=StyleColorways($select=StyleColorwayId,MinimumQuantity,ColorwayUserField4,ColorwayStatus;$expand=Theme($select=Id,Description))`
3. Style seviyesinden eşleşme boyutları alınır:
   - `BrandId` → Marka
   - `DivisionId` → Bölüm
   - `SubCategoryId` → Kategori (fallback için, GLrefId 65)
   - `ProductSubSubCategoryId` → Alt Kategori (GLrefId 69)
   - `SeasonId` → Sezon
4. Her colorway için:
   - `ColorwayUserField4` → LifeStyle Grubu
   - `Theme.Description` (PID, örn. `Theme_Attributes-403-0-LATEST`) → IDM `IDM/api/items/{pid}`
     çağrısıyla `Cluster` ve `Alt_Sezon` öznitelikleri okunur.
5. Adet, `costingDB` Ön Adet Parametreleri tablosundan **kademeli** çözülür:
   - **L1** Alt Kategori (ProductSubSubCategory) tam eşleşmesi
   - **L2** Kategori (SubCategory) seviyesinde ortalama
   - **L3** Bölüm seviyesinde (kategori bağımsız) ortalama
   - Marka + Bölüm + Sezon + Cluster + LifeStyle + Alt Sezon her seviyede sabittir.
6. `Style.Status = 103` ise veya `ColorwayStatus != 1` ise ilgili adet **0**.
7. `FASHIONPLM/odata2/api/odata2/STYLECOLORWAYS` toplu PATCH'lenir
   (`[{ StyleColorwayId, MinimumQuantity }]`).
8. `FASHIONPLM/odata2/api/odata2/Style({StyleId})` PATCH'lenir
   (`{ NumericValue1: <toplam adet> }`).

## Uç noktalar

| Method | Yol | Açıklama |
| --- | --- | --- |
| `POST` | `/api/assign-prequantity` | Body `{ "styleId": 15344, "dryRun": false }` |
| `POST` | `/api/assign-prequantity/:styleId` | styleId path'ten |
| `GET`  | `/api/assign-prequantity/:styleId?dryRun=true` | Yazmadan önizleme |
| `GET`  | `/` | Sağlık / durum |

`dryRun=true` PLM'e **yazmadan** hesabı döner (test için).

## Ortam değişkenleri

Hiçbiri **zorunlu değildir** — env ayarı yapmadan deploy edebilirsiniz. Tüm
varsayılanlar (PLM PRD tenant kimlik bilgileri + costingDB prod adresi) koda gömülüdür.

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `PLM_ENV` | `prd` | `test` verilirse TST tenant; aksi halde **PRD (varsayılan)** |
| `PORT` | `3099` | HTTP portu (Heroku otomatik atar) |
| `COSTING_DB_API_URL` | `https://costingdb-8538ae5b78bc.herokuapp.com/api` | Ön Adet Parametreleri REST API kökü |

## Yerel çalıştırma

```bash
npm install
npm start
# önizleme
curl "http://localhost:3099/api/assign-prequantity/15344?dryRun=true"
```

## Heroku deploy

```bash
heroku create <app-adi>
git push heroku main
# Env ayarı gerekmez; varsayılan PRD tenant ve prod costingDB adresi koda gömülüdür.
```

## Yanıt örneği (dryRun)

```json
{
  "styleId": 15344,
  "styleCode": "TS1270002196",
  "status": 2,
  "forcedZero": false,
  "dimensions": { "brandId": 8, "divisionId": 6, "subCategoryId": 20, "productSubSubCategoryId": 56, "seasonId": 11 },
  "totalQty": 120,
  "colorways": [
    { "styleColorwayId": 17012, "currentQty": 0, "colorwayStatus": 1, "lifestyle": 3, "cluster": "013", "altSezon": "FW1", "newQty": 120, "level": "L1-alt_kategori", "note": "L1-alt_kategori (1 kayıt)", "error": null }
  ],
  "errors": [],
  "patched": { "colorways": 0, "styleTotal": false },
  "dryRun": true
}
```
