const express = require('express');
const router = express.Router();
const quantityService = require('../services/quantityService');

/**
 * Ön adet atama.
 * styleId query, body veya path'ten alınabilir. dryRun=true ile PLM'e yazmadan
 * sadece hesap döner (test/önizleme için).
 *
 * POST /api/assign-prequantity            body: { "styleId": 15344, "dryRun": false }
 * POST /api/assign-prequantity?styleId=15344
 * GET  /api/assign-prequantity/15344?dryRun=true
 */
async function handle(req, res) {
  const styleId = req.params.styleId || req.body.styleId || req.query.styleId || req.body.moduleId || req.query.moduleId;
  const dryRun = String(req.query.dryRun || req.body.dryRun || '').toLowerCase() === 'true';

  if (!styleId) {
    return res.status(400).json({ error: 'styleId zorunludur (path, query veya body).' });
  }

  try {
    const result = await quantityService.assignPreQuantity(styleId, { dryRun });
    res.json(result);
  } catch (err) {
    const code = err.statusCode || 500;
    res.status(code).json({ error: err.message });
  }
}

router.post('/assign-prequantity', handle);
router.post('/assign-prequantity/:styleId', handle);
router.get('/assign-prequantity/:styleId', handle);

module.exports = router;
