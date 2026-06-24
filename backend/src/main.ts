import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { existsSync } from 'fs';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Serve frontend static files (fallback for any non-API route)
  // Docker: /app/dist -> /app/frontend/dist
  // Local:  backend/dist -> ../../frontend/dist
  const candidates = [
    join(__dirname, '..', 'frontend', 'dist'),
    join(__dirname, '..', '..', 'frontend', 'dist'),
  ];
  const frontendPath = candidates.find(p => existsSync(join(p, 'index.html'))) ?? candidates[0];

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
