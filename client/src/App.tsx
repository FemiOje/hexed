import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { Toaster } from "react-hot-toast";
import "./App.css";
import { ControllerProvider } from "./contexts/controller";
import { GameDirectorProvider } from "./contexts/GameDirector";
import StartPage from "./pages/StartPage";
import GamePage from "./pages/GamePage";

const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#2196f3',
        },
        secondary: {
            main: '#4caf50',
        },
    },
});

function App() {
    return (
        <BrowserRouter>
            <ThemeProvider theme={theme}>
                <ControllerProvider>
                    <GameDirectorProvider>
                        <Toaster
                            position="bottom-right"
                            toastOptions={{
                                style: {
                                    background: '#1a1a2e',
                                    color: '#fff',
                                    border: '1px solid #333',
                                },
                                success: { duration: 3000 },
                                error: { duration: 4000 },
                            }}
                        />
                        <Routes>
                            <Route path="/" element={<StartPage />} />
                            <Route path="/game" element={<GamePage />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </GameDirectorProvider>
                </ControllerProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}

export default App;
