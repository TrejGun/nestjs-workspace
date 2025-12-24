import { Logger, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { SafeService } from "./safe.service";
import { safeProvider } from "./safe.provider";

@Module({
  imports: [ConfigModule],
  providers: [safeProvider, Logger, SafeService],
  exports: [SafeService],
})
export class SafeModule {}
