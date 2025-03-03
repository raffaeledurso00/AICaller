// packages/backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SecurityInterceptor } from './common/interceptors/security.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3000;
  const logger = new Logger('Bootstrap');

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.enableCors();

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    app.get(SecurityInterceptor) // Apply security interceptor globally
  );

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AI Telemarketing API')
      .setDescription('API for AI-powered telemarketing system')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Set up global uncaught exception and unhandled rejection handlers
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error.stack);
    // Allow process to exit naturally or restart through external process manager like PM2
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    // Allow process to exit naturally or restart through external process manager like PM2
  });

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}

// Make sure to await the bootstrap function or handle the promise properly
void bootstrap().catch((err) => {
  console.error('Failed to start the application:', err);
  process.exit(1);
});