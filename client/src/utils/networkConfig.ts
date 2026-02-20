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
    namespace: "hexed",
    rpcUrl: import.meta.env.VITE_KATANA_RPC_URL || "http://localhost:5050",
    toriiUrl: import.meta.env.VITE_KATANA_TORII_URL || "http://localhost:8080",
    manifest: manifest_dev,
  },
  SN_SEPOLIA: {
    chainId: ChainId.SN_SEPOLIA,
    namespace: "hexed",
    rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL || "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9",
    toriiUrl: "https://api.cartridge.gg/x/hexed/torii",
    manifest: manifest_sepolia,
  },
};

export function getNetworkConfig(networkKey: ChainId): NetworkConfig {
  const network = NETWORKS[networkKey as keyof typeof NETWORKS];
  if (!network) throw new Error(`Network ${networkKey} not found`);

  const gameContract = network.manifest.contracts.find((c: any) => c.tag === "hexed-game_systems")?.address || "";
  const policies = networkKey === ChainId.SN_SEPOLIA
    ? [
        { target: gameContract, method: "spawn" },
        { target: gameContract, method: "move" },
        { target: gameContract, method: "get_game_state" },
      ]
    : undefined;

  return {
    chainId: network.chainId,
    namespace: network.namespace,
    manifest: network.manifest,
    preset: "hexed",
    slot: "hexed",
    policies,
    rpcUrl: network.rpcUrl,
    toriiUrl: network.toriiUrl,
    chains: [{ rpcUrl: network.rpcUrl }],
  };
}

export function stringToFelt(str: string): string {
  return str ? shortString.encodeShortString(str) : "0x0";
}

/**
 * Get contract by name from manifest following death-mountain pattern
 * @param manifest - The Dojo manifest containing contract definitions
 * @param namespace - The namespace to search within (e.g., "untitled")
 * @param name - The contract name/tag to search for (e.g., "actions")
 * @returns The contract object or undefined if not found
 */
export function getContractByName(
  manifest: any,
  namespace: string,
  name: string
): { address: string; classHash: string; tag: string } | undefined {
  if (!manifest || !manifest.contracts) {
    console.warn("Manifest or contracts not found");
    return undefined;
  }

  // Search for contract by tag matching namespace-name pattern
  const targetTag = `${namespace}-${name}`;
  const contract = manifest.contracts.find((c: any) => c.tag === targetTag);

  if (!contract) {
    console.warn(`Contract "${targetTag}" not found in manifest`);
    return undefined;
  }

  return {
    address: contract.address,
    classHash: contract.class_hash,
    tag: contract.tag,
  };
}

/**
 * Helper to get contract address directly
 * @param manifest - The Dojo manifest
 * @param namespace - The namespace
 * @param name - The contract name
 * @returns The contract address or undefined
 */
export function getContractAddress(
  manifest: any,
  namespace: string,
  name: string
): string | undefined {
  return getContractByName(manifest, namespace, name)?.address;
}

/**
 * Get all system methods for a contract
 * @param manifest - The Dojo manifest
 * @param namespace - The namespace
 * @param name - The contract name
 * @returns Array of system method names
 */
export function getContractSystems(
  manifest: any,
  namespace: string,
  name: string
): string[] {
  const contract = getContractByName(manifest, namespace, name);
  return contract ? (manifest.contracts.find((c: any) => c.tag === contract.tag)?.systems || []) : [];
}
