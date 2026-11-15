const express = require('express');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { appFactory } = require('./app.cjs');
const { databases } = require('./db.cjs');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4000);
const displayHost = host === '127.0.0.1' ? 'localhost' : host;
const serverUrl = `http://${displayHost}:${port}`;

const dbs = databases();
const app = express();

app.disable('x-powered-by');

app.use((req, res, next) => {
  const requestPath = req.path;

  if (requestPath.startsWith('/api/')) {
    const startedAt = performance.now();

    res.once('finish', () => {
      const elapsedMs = Math.round(performance.now() - startedAt);

      console.log(
        `[API] ${req.method} ${requestPath} → ${res.statusCode} (${elapsedMs} ms)`
      );
    });
  }

  next();
});

app.use(appFactory(dbs));
app.use(express.static(path.resolve(__dirname, '../../frontend/dist')));

const server = app.listen(port, host, () => {
  console.log('Smart Desk Jewels API is running');
  console.log(`API:    ${serverUrl}/api/v1`);
  console.log(`Health: ${serverUrl}/api/v1/health`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(async () => {
      try {
        await dbs.close();
      } catch (error) {
        console.error('Failed to close database connections:', error.message);
        process.exitCode = 1;
      }
    });
  });
}