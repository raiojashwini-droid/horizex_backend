import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import masterRouter from './routes';
import { env } from './config/env';
import { generalLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';
import { sendError } from './utils/apiResponse.util';

const app: Application = express();

// 1. Edge Security & Headers
app.use(helmet());

// 2. CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);
      const allowedOrigins = [env.CORS_ORIGIN, 'http://localhost:5173', 'http://localhost:3000'];
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('CORS origin policy blocked request'));
    },
    credentials: true,
  })
);

// 3. Body Parsing & Cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 4. Rate Limiting
app.use('/api', generalLimiter);

// 5. API Routes
app.use('/api', masterRouter);

// 6. 404 Route Handler
app.use((req: Request, res: Response) => {
  return sendError(res, 'ENDPOINT_NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`, 404);
});

// 7. Centralized Global Error Handler
app.use(errorHandler);

export default app;

