import { useController } from "../contexts/controller";
import { useAccount } from "@starknet-react/core";
import { Button } from "@mui/material";
import { Swords } from "lucide-react";

const ellipseAddress = (address: string, start = 4, end = 4): string => {
  if (!address) return "";
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

function WalletConnect() {
  const { isPending, playerName, login, openProfile } = useController();
  const { account, address } = useAccount();

  return (
    <>
      {account && address ? (
        <Button
          onClick={() => openProfile()}
          disabled={!playerName}
          variant="outlined"
          size="small"
          startIcon={<Swords size={16} />}
          sx={{
            minWidth: '100px',
            borderRadius: 0,
            borderColor: 'rgba(0, 212, 255, 0.3)',
            color: 'rgba(0, 212, 255, 0.9)',
            letterSpacing: '2px',
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            transition: 'color 0.2s, border-color 0.2s',
            '&:hover': {
              borderColor: 'rgba(0, 212, 255, 0.6)',
              color: '#00d4ff',
              backgroundColor: 'rgba(0, 212, 255, 0.05)',
            },
          }}
        >
          {playerName ? playerName : ellipseAddress(address, 4, 4)}
        </Button>
      ) : (
        <Button
          onClick={() => login()}
          disabled={isPending}
          variant="outlined"
          size="small"
          startIcon={<Swords size={16} />}
          sx={{
            minWidth: '100px',
            borderRadius: 0,
            borderColor: 'rgba(0, 212, 255, 0.3)',
            color: 'rgba(0, 212, 255, 0.9)',
            letterSpacing: '2px',
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            transition: 'color 0.2s, border-color 0.2s',
            '&:hover': {
              borderColor: 'rgba(0, 212, 255, 0.6)',
              color: '#00d4ff',
              backgroundColor: 'rgba(0, 212, 255, 0.05)',
            },
            '&:disabled': {
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.3)',
            },
          }}
        >
          {isPending ? "Connecting..." : "Log In"}
        </Button>
      )}
    </>
  );
}

export default WalletConnect;
