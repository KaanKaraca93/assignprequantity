const express = require('express');
const assignRoutes = require('./routes/assign.routes');
const tokenService = require('./services/tokenService');
const APP = require('./config/app.config');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.json({
    service: 'assignprequantity',
    status: 'up',
    costingDbApiUrl: APP.costingDbApiUrl,
    token: tokenService.getTokenInfo()
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', assignRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = process.env.PORT || 3099;
app.listen(PORT, () => {
  console.log(`assignprequantity API ${PORT} portunda çalışıyor`);
});

module.exports = app;
