import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const host = configService.get<string>("HOST", "localhost");
  const port = configService.get<string>("PORT", "3001");

  await app.listen(Number(port), host, () => {
    console.info(`API server is running on http://${host}:${port}`);
  });
}
bootstrap();
