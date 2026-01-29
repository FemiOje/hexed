import type { PropsWithChildren } from "react";
import { mainnet, sepolia, Chain } from "@starknet-react/chains";
import { jsonRpcProvider, StarknetConfig, cartridge } from "@starknet-react/core";
import { ChainId, getNetworkConfig, NetworkConfig } from "@/utils/networkConfig";
import ControllerConnector from "@cartridge/connector/controller";
import { AuthOptions } from "@cartridge/controller";
import {
  createContext,
  useContext,
  useState
} from "react";
import { num, shortString, constants } from "starknet";

interface DynamicConnectorContext {
  setCurrentNetworkConfig: (network: NetworkConfig) => void;
  currentNetworkConfig: NetworkConfig;
}

const DynamicConnectorContext = createContext<DynamicConnectorContext | null>(
  null
);

// Token contract addresses
export const ETH_CONTRACT_ADDRESS =
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
export const STRK_CONTRACT_ADDRESS =
  "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D";

// Get network configuration based on environment or default to Sepolia
const defaultNetwork = ChainId.SN_SEPOLIA;
const controllerConfig = getNetworkConfig(defaultNetwork);

// Build session policies for contract interactions
const buildPolicies = (networkConfig: NetworkConfig) => {
  const policies: any = {
    contracts: {},
  };

  // Add game contract policies if they exist
  if (networkConfig.policies && networkConfig.policies.length > 0) {
    const gameContractAddress = networkConfig.policies[0].target;
    if (gameContractAddress && gameContractAddress !== "") {
      policies.contracts[gameContractAddress] = {
        methods: networkConfig.policies.map((policy) => ({
          name: policy.method,
          entrypoint: policy.method,
        })),
      };
    }
  }

  // Add standard token policies
  policies.contracts[ETH_CONTRACT_ADDRESS] = {
    methods: [
      { name: "approve", entrypoint: "approve" },
      { name: "transfer", entrypoint: "transfer" },
    ],
  };

  policies.contracts[STRK_CONTRACT_ADDRESS] = {
    methods: [
      { name: "approve", entrypoint: "approve" },
      { name: "transfer", entrypoint: "transfer" },
    ],
  };

  return policies;
};

// Configure authentication options
const signupOptions: AuthOptions = [
  "google",
  "webauthn",
  "discord",
  "walletconnect",
  "password",
];

// Setup chains
let localKatanaChain: Chain | undefined = undefined;
if (controllerConfig.chainId === ChainId.KATANA) {
  localKatanaChain = {
    id: num.toBigInt(shortString.encodeShortString(controllerConfig.namespace)),
    network: controllerConfig.namespace,
    name: "Katana",
    rpcUrls: {
      default: {
        http: [controllerConfig.rpcUrl],
      },
      public: {
        http: [controllerConfig.rpcUrl],
      },
    },
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
      address: ETH_CONTRACT_ADDRESS,
    },
    paymasterRpcUrls: {
      default: {
        http: [],
      },
    },
  };
}

const starknetConfigChains = [sepolia, mainnet].filter(Boolean) as Chain[];
if (localKatanaChain) {
  starknetConfigChains.push(localKatanaChain);
}

const controllerConnectorChains: { rpcUrl: string }[] = [
  { rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9" },
  { rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9" },
];

if (controllerConfig.chainId === ChainId.KATANA) {
  controllerConnectorChains.push({ rpcUrl: controllerConfig.rpcUrl });
}
const policies = buildPolicies(controllerConfig);

const getControllerDefaultChainId = () => {
  if (controllerConfig.chainId === ChainId.SN_SEPOLIA) {
    return constants.StarknetChainId.SN_SEPOLIA;
  }
  if (controllerConfig.chainId === ChainId.KATANA && localKatanaChain) {
    return shortString.encodeShortString(controllerConfig.namespace);
  }
  return constants.StarknetChainId.SN_SEPOLIA;
};

const cartridgeController =
  typeof window !== "undefined"
    ? new ControllerConnector({
        policies,
        chains: controllerConnectorChains,
        defaultChainId: getControllerDefaultChainId(),
        url: "https://x.cartridge.gg",
        signupOptions,
        namespace: controllerConfig.namespace,
        // slot: controllerConfig.slot,
        preset: controllerConfig.preset,
        tokens: {
          erc20: ["eth", "strk"],
        },
        lazyload: true,
      })
    : null;

// Configure RPC provider
const provider = jsonRpcProvider({
  rpc: (chain: Chain) => {
    if (chain.id === sepolia.id) {
      return {
        nodeUrl: controllerConfig.chainId === ChainId.SN_SEPOLIA
          ? controllerConfig.rpcUrl
          : "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9"
      };
    }
    if (chain.id === mainnet.id) {
      return { nodeUrl: "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9" };
    }
    if (localKatanaChain && chain.id === localKatanaChain.id) {
      return { nodeUrl: controllerConfig.rpcUrl };
    }
    return null;
  },
});

// Determine default chain ID based on network config
const getDefaultChainId = (chainId: ChainId) => {
  if (chainId === ChainId.KATANA && localKatanaChain) {
    return localKatanaChain.id;
  }
  return sepolia.id;
};

export function DynamicConnectorProvider({ children }: PropsWithChildren) {
  const [currentNetworkConfig, setCurrentNetworkConfig] =
    useState<NetworkConfig>(getNetworkConfig(defaultNetwork));

  return (
    <DynamicConnectorContext.Provider
      value={{
        setCurrentNetworkConfig,
        currentNetworkConfig,
      }}
    >
      <StarknetConfig
        autoConnect={false}
        defaultChainId={getDefaultChainId(currentNetworkConfig.chainId)}
        chains={starknetConfigChains}
        connectors={cartridgeController ? [cartridgeController] : []}
        explorer={cartridge}
        provider={provider}
      >
        {children}
      </StarknetConfig>
    </DynamicConnectorContext.Provider>
  );
}

export function useDynamicConnector() {
  const context = useContext(DynamicConnectorContext);
  if (!context) {
    throw new Error(
      "useDynamicConnector must be used within a DynamicConnectorProvider"
    );
  }
  return context;
}

export default DynamicConnectorProvider;
