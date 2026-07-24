import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
let app: express.Application | undefined;

function getApp() {
  if (app) return app;
  app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  const basePath = path.join(process.cwd(), 'server', 'dist', 'server', 'src');
  const { yahooRoutes } = require(path.join(basePath, 'routes', 'yahoo.js'));
  app.use('/yahoo', yahooRoutes);
  return app;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const pathParam = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
  const url = new URL(req.url ?? '', 'http://localhost');
  url.searchParams.delete('path');
  req.url = `/yahoo${pathParam ? `/${pathParam}` : ''}${url.search}`;
  return getApp()(req, res);
}
