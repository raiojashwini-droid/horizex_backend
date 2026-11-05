import app from './app';
import { env } from './config/env';
import { prisma } from './config/db';

const PORT = parseInt(env.PORT, 10) || 5000;

async function bootstrap() {
  try {
    // Verify database connectivity
    console.log('🔄 Connecting to PostgreSQL database via Prisma...');
    await prisma.$connect();
    console.log('✅ PostgreSQL connection established successfully.');

    const server = app.listen(PORT, () => {
      console.log(`🚀 Horizex Property Pro API running at http://localhost:${PORT}/api`);
      console.log(`🛡️  Environment: ${env.NODE_ENV}`);
      console.log(`🌐 CORS Whitelist: ${env.CORS_ORIGIN}`);
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('🔌 Prisma client disconnected. Server closed cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('❌ Failed to start backend server:', error);
    process.exit(1);
  }
}

bootstrap();

