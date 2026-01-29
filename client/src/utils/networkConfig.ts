import manifest_dev from "../manifests/manifest_dev.json";
import manifest_sepolia from "../manifests/manifest_sepolia.json";
import { shortString } from "starknet";

export interface NetworkConfig {
  chainId: ChainId;
  namespace: string;
  manifest: any;
  slot?: string;
  preset: string;
  policies:
    | Array<{
        target: string;
        method: string;
      }>
    | undefined;
  rpcUrl: string;
  toriiUrl: string;
  chains: Array<{
    rpcUrl: string;
  }>;
}

export enum ChainId {
  KATANA = "KATANA",
  SN_SEPOLIA = "SN_SEPOLIA",
}

export const NETWORKS = {
  KATANA: {
    chainId: ChainId.KATANA,
    namespace: "untitled",
    rpcUrl: import.meta.env.VITE_KATANA_RPC_URL || "http://localhost:5050",
    toriiUrl: import.meta.env.VITE_KATANA_TORII_URL || "http://localhost:8080",
    manifest: manifest_dev,
  },
  SN_SEPOLIA: {
    chainId: ChainId.SN_SEPOLIA,
    namespace: "untitled",
    rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL || "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9",
    toriiUrl: "https://api.cartridge.gg/x/untitled/torii",
    manifest: manifest_sepolia,
  },
};

export function getNetworkConfig(networkKey: ChainId): NetworkConfig {
  const network = NETWORKS[networkKey as keyof typeof NETWORKS];
  if (!network) throw new Error(`Network ${networkKey} not found`);

  const policies = networkKey === ChainId.SN_SEPOLIA
    ? [
        {
          target: network.manifest.contracts.find((c: any) => c.tag === "untitled-actions")?.address || "",
          method: "spawn",
        },
        {
          target: network.manifest.contracts.find((c: any) => c.tag === "untitled-actions")?.address || "",
          method: "move",
        },
      ]
    : undefined;

  return {
    chainId: network.chainId,
    namespace: network.namespace,
    manifest: network.manifest,
    preset: "untitled",
    slot: "untitled",
    policies,
    rpcUrl: network.rpcUrl,
    toriiUrl: network.toriiUrl,
    chains: [{ rpcUrl: network.rpcUrl }],
  };
}

export function stringToFelt(str: string): string {
  return str ? shortString.encodeShortString(str) : "0x0";
}
