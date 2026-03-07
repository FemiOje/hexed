import { useNavigate } from 'react-router-dom';
import WalletConnect from "./WalletConnect";
import { Box, Typography, IconButton } from '@mui/material';
import { HelpCircle, Volume2, VolumeX } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';

function Header() {
  const navigate = useNavigate();
  const { setShowHelpModal, musicEnabled, toggleMusic } = useUIStore();

  return (
    <Box sx={styles.header}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="h6"
          onClick={() => navigate('/')}
          sx={{ color: '#44cc44', fontWeight: 600, cursor: 'pointer' }}
        >
          HEX'D
        </Typography>
      </Box>

      <Box sx={styles.headerButtons}>
        <IconButton
          onClick={toggleMusic}
          sx={styles.helpButton}
          size="small"
          aria-label={musicEnabled ? 'Mute music' : 'Play music'}
        >
          {musicEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </IconButton>
        <IconButton
          onClick={() => setShowHelpModal(true)}
          sx={styles.helpButton}
          size="small"
          aria-label="How to play"
        >
          <HelpCircle size={20} />
        </IconButton>
        <WalletConnect />
      </Box>
    </Box>
  );
}

export default Header;

const styles = {
  header: {
    width: '100%',
    height: '50px',
    borderBottom: '2px solid rgba(17, 17, 17, 1)',
    background: 'black',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
    px: '10px'
  },
  headerButtons: {
    display: 'flex',
    height: '36px',
    alignItems: 'center',
    gap: 2
  },
  helpButton: {
    color: 'rgba(68, 204, 68, 0.7)',
    transition: 'all 0.2s',
    '&:hover': {
      color: '#44cc44',
      backgroundColor: 'rgba(68, 204, 68, 0.1)',
    }
  }
};
