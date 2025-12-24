import { ConfigService } from "@nestjs/config";
import { defineChain } from "viem";
import { polygon } from "viem/chains";

export const CHAIN_PROVIDER = Symbol("CHAIN_PROVIDER");

export const safeProvider = {
  provide: CHAIN_PROVIDER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const rpcUrl = configService.get<string>("RPC_URL", "http://localhost:8545/");

    const polygonWithRpc = defineChain({
      ...polygon,
      rpcUrls: {
        default: {
          http: [rpcUrl],
        },
      },
    });

    return polygonWithRpc
  },
};
