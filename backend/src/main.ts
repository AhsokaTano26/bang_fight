import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Serve frontend static files (fallback for any non-API route)
  const frontendPath = join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));
  app.use((req: any, res: any, next: any) => {
    if (req.path.startsWith('/game')) {
      return next();
    }
    res.sendFile(join(frontendPath, 'index.html'));
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
