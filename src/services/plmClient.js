const axios = require('axios');
const tokenService = require('./tokenService');
const PLM_CONFIG = require('../config/plm.config');

/**
 * PLM/ION ionapi tabanına (tenant dahil) istek atan ince bir sarmalayıcı.
 * Her istekte geçerli OAuth token'ı header'a ekler.
 */
const baseUrl = `${PLM_CONFIG.ionApiUrl}/${PLM_CONFIG.tenantId}`;

async function request(method, path, { params, data } = {}) {
  const authHeader = await tokenService.getAuthorizationHeader();
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  try {
    const resp = await axios({
      method,
      url,
      params,
      data,
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });
    return resp.data;
  } catch (err) {
    const status = err.response ? err.response.status : '?';
    const detail = err.response ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`PLM ${method} ${path} başarısız (HTTP ${status}): ${detail}`);
  }
}

module.exports = {
  get: (path, params) => request('GET', path, { params }),
  patch: (path, data) => request('PATCH', path, { data }),
  post: (path, data) => request('POST', path, { data })
};
