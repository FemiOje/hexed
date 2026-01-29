import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";

import { init } from "@dojoengine/sdk";
import { DojoSdkProvider } from "@dojoengine/sdk/react";
import type { SchemaType } from "./typescript/models.gen.ts";
import { setupWorld } from "./typescript/contracts.gen.ts";

import "./index.css";
import DynamicConnectorProvider, { useDynamicConnector } from "./starknet-provider.tsx";
import { createDojoConfig } from "@dojoengine/core";

/**
 * Initializes SDK based on current network configuration
 */
function DojoApp() {
  const { currentNetworkConfig } = useDynamicConnector();
  const [sdk, setSdk] = useState<any>(null);

  useEffect(() => {
    async function initializeSdk() {
      try {
        const initializedSdk = await init<SchemaType>({
          client: {
            toriiUrl: currentNetworkConfig.toriiUrl,
            worldAddress: currentNetworkConfig.manifest.world.address,
          },
          domain: {
            name: "Untitled",
            version: "1.0",
            chainId: currentNetworkConfig.chainId,
            revision: "1",
          },
        });
        setSdk(initializedSdk);
      } catch (error) {
        console.error("Failed to initialize SDK:", error);
      }
    }

    if (currentNetworkConfig) {
      initializeSdk();
    }
  }, [currentNetworkConfig]);

  return (
    <DojoSdkProvider
      sdk={sdk}
      dojoConfig={createDojoConfig(currentNetworkConfig)}
      clientFn={setupWorld}
    >
      <App />
    </DojoSdkProvider>
  );
}

/**
 * Initializes and bootstraps the Dojo application.
 * Sets up the network provider and renders the root component.
 *
 * @throws {Error} If initialization fails
 */
async function main() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <DynamicConnectorProvider>
        <DojoApp />
      </DynamicConnectorProvider>
    </StrictMode>
  );
}

main().catch((error) => {
  console.error("Failed to initialize the application:", error);
});
