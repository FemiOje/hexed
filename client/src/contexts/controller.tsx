import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

export interface ControllerContext {
  account: any;
  address: string | undefined;
  playerName: string;
  isPending: boolean;
  openProfile: () => void;
  login: () => void;
  logout: () => void;
}

const ControllerContext = createContext<ControllerContext>(
  {} as ControllerContext,
);

export const ControllerProvider = ({ children }: PropsWithChildren) => {
  const { account, address, isConnecting } = useAccount();
  const { connector, connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [userName, setUserName] = useState<string>();

  useEffect(() => {
    const getUsername = async () => {
      try {
        const name = await (connector as any)?.username?.();
        if (name) setUserName(name);
      } catch (error) {
        setUserName("Unnamed Player");
      }
    };

    if (connector) getUsername();
  }, [connector]);

  const handleLogin = () => {
    // Try to find controller connector first, otherwise use first available
    const controllerConnector = connectors.find(
      (conn) => conn.id === "controller",
    );
    const targetConnector = controllerConnector || connectors[0];

    if (!targetConnector) {
      console.error("No connector found");
      return;
    }

    connect({ connector: targetConnector });
  };

  const handleOpenProfile = () => {
    // Only works with Cartridge Controller
    if ((connector as any)?.controller?.openProfile) {
      (connector as any).controller.openProfile();
    }
  };

  return (
    <ControllerContext.Provider
      value={{
        account,
        address,
        playerName: userName || "",
        isPending: isConnecting || isPending,
        openProfile: handleOpenProfile,
        login: handleLogin,
        logout: () => disconnect(),
      }}
    >
      {children}
    </ControllerContext.Provider>
  );
};

export const useController = () => {
  const context = useContext(ControllerContext);
  if (!context) {
    throw new Error("useController must be used within a ControllerProvider");
  }
  return context;
};
