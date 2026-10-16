import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { corsOptions } from './config/cors.js';
import { env, isProd } from './config/env.js';
import { errorHandler, notFound } from './middlewares/error.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  // Behind a hosting proxy (Render, Railway, Nginx…) so rate limits see the real client IP.
  // Defaults to 1; TRUST_PROXY=false when there is no proxy.
  app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Images and documents are loaded by the frontend from another origin
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(morgan(isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 2000,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, message: 'Too many requests, please slow down.' },
    })
  );

  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
