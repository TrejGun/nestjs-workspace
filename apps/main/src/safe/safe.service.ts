import { Inject, Injectable, InternalServerErrorException, Logger, LoggerService } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createWalletClient, encodeFunctionData, Hash, http, zeroHash, zeroAddress } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

// import Safe from "@main-global/protocol-kit";
const Safe = require("@safe-global/protocol-kit");

@Injectable()
export class SafeService {
  constructor(
    @Inject(Logger)
    private readonly loggerService: LoggerService,
    private readonly configService: ConfigService,
  ) {}

  public async mint(): Promise<string> {
    const adminPrivateKey = this.configService.get<Hash>("PRIVATE_KEY_1", zeroHash);

    const account = privateKeyToAccount(adminPrivateKey);
    const client = createWalletClient({
      account,
      chain: polygon,
      transport: http(),
    });

    const transactionHash = await client.sendTransaction({
      to: zeroAddress,
      data: encodeFunctionData({
        abi: [
          {
            inputs: [
              {
                internalType: "address",
                name: "to",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "id",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
              },
              {
                internalType: "bytes",
                name: "data",
                type: "bytes",
              },
            ],
            name: "mint",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "mint",
        args: [zeroAddress, 1n, 1n, "0x"],
      }),
    });

    this.loggerService.log(`Transaction hash: ${transactionHash}`, SafeService.name);

    await waitForTransactionReceipt(client, { hash: transactionHash });

    return transactionHash;
  }

  public async deploy(address: string): Promise<string> {
    const adminPrivateKey = this.configService.get<Hash>("PRIVATE_KEY_1", zeroHash);
    const backupPrivateKey = this.configService.get<Hash>("PRIVATE_KEY_2", zeroHash);
    const rpcUrl = this.configService.get<string>("RPC_URL", "http://localhost:8545/");

    const adminAccount = privateKeyToAccount(adminPrivateKey);
    const backupAccount = privateKeyToAccount(backupPrivateKey);

    const protocolKitAdmin = await Safe.init({
      provider: rpcUrl,
      signer: adminPrivateKey,
      predictedSafe: {
        safeAccountConfig: {
          owners: [adminAccount.address, backupAccount.address, address],
          threshold: 2,
        },
        safeDeploymentConfig: {
          saltNonce: Date.now().toString(), // ensures unique address
        },
      },
    });

    const predictedSafeAddress = await protocolKitAdmin.getAddress();

    const deploymentTransaction = await protocolKitAdmin.createSafeDeploymentTransaction();

    const client = await protocolKitAdmin.getSafeProvider().getExternalSigner();

    if (!client) {
      this.loggerService.log("Unable to get Signer", SafeService.name);
      throw new InternalServerErrorException("internalServerError");
    }

    const transactionHash = await client.sendTransaction({
      to: deploymentTransaction.to as Hash,
      value: BigInt(deploymentTransaction.value),
      data: deploymentTransaction.data as Hash,
      chain: polygon,
    });

    await waitForTransactionReceipt(client, { hash: transactionHash });

    const safe = await protocolKitAdmin.connect({
      safeAddress: predictedSafeAddress,
    });

    const isSafeDeployed = await safe.isSafeDeployed();

    if (!isSafeDeployed) {
      this.loggerService.log(`Safe was not deployed :(`, SafeService.name);
      throw new InternalServerErrorException("internalServerError");
    }

    const actualSafeAddress = await safe.getAddress();

    if (predictedSafeAddress !== actualSafeAddress) {
      this.loggerService.log(
        `Safe predicted address ${predictedSafeAddress} is different from the actual address ${actualSafeAddress}`,
        SafeService.name,
      );
      throw new InternalServerErrorException("internalServerError");
    }

    return actualSafeAddress;
  }
}
