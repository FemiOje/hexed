import { useUIStore } from "@/stores/uiStore";
import { useGameStore } from "@/stores/gameStore";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

/**
 * Music Credits
 *
 * All tracks from "Dark Ambient Music and Textures" by DDmyzik (2019)
 * Source: https://archive.org/details/darkambient_201908
 * Available via Internet Archive — free to use
 *
 * Tracks used:
 *   - "Crime"            — Intro / Start screen
 *   - "Documentary Dark" — Gameplay
 *   - "Universal Pain"   — Gameplay
 *   - "Gloomy"           — Death screen
 */
const tracks = {
  intro: "https://archive.org/download/darkambient_201908/Crime.mp3",
  gameplay: [
    "https://archive.org/download/darkambient_201908/Documentary%20Dark.mp3",
    "https://archive.org/download/darkambient_201908/Universal%20Pain.mp3",
  ],
  death: "https://archive.org/download/darkambient_201908/Gloomy.mp3",
};

type GamePhase = "intro" | "gameplay" | "death";

/**
 * AudioManager — imperative audio control outside React's effect cycle.
 * Follows death-mountain's AudioManager pattern.
 */
class AudioManager {
  private audio: HTMLAudioElement;
  private currentPhase: GamePhase | null = null;
  private gameplayIndex = 0;

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.audio.loop = true;
    this.audio.volume = 0.3;

    // Rotate gameplay tracks when one ends
    this.audio.addEventListener("ended", () => {
      if (this.currentPhase !== "gameplay") return;
      this.gameplayIndex =
        (this.gameplayIndex + 1) % tracks.gameplay.length;
      this.audio.src = tracks.gameplay[this.gameplayIndex];
      this.audio.play().catch(() => {});
    });
  }

  async play() {
    await this.audio.play().catch(() => {});
  }

  pause() {
    this.audio.pause();
  }

  switchPhase(phase: GamePhase) {
    if (phase === this.currentPhase) return;
    this.currentPhase = phase;

    switch (phase) {
      case "intro":
        this.audio.src = tracks.intro;
        this.audio.loop = true;
        break;
      case "gameplay":
        this.gameplayIndex = 0;
        this.audio.src = tracks.gameplay[0];
        this.audio.loop = false;
        break;
      case "death":
        this.audio.src = tracks.death;
        this.audio.loop = true;
        break;
    }

    // Eagerly attempt play — browser will block if no gesture yet,
    // but the track is loaded and ready for when the user interacts.
    this.audio.play().catch(() => {});
  }

  destroy() {
    this.audio.pause();
    this.audio.src = "";
  }
}

interface SoundContextType {
  hasInteracted: boolean;
}

const SoundContext = createContext<SoundContextType>({
  hasInteracted: false,
});

export const SoundProvider = ({ children }: PropsWithChildren) => {
  const musicEnabled = useUIStore((s) => s.musicEnabled);
  const isDead = useGameStore((s) => s.isDead);
  const location = useLocation();

  const [hasInteracted, setHasInteracted] = useState(false);

  // Instantiate AudioManager during render (not in an effect) — same as death-mountain
  const manager = useRef(new AudioManager());

  const phase: GamePhase =
    location.pathname === "/game" ? (isDead ? "death" : "gameplay") : "intro";

  // Detect first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      setHasInteracted(true);
      if (musicEnabled) {
        manager.current.play();
      }
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("touchstart", handleFirstInteraction);
      document.removeEventListener("keydown", handleFirstInteraction);
    };
    document.addEventListener("click", handleFirstInteraction);
    document.addEventListener("touchstart", handleFirstInteraction);
    document.addEventListener("keydown", handleFirstInteraction);
    return () => {
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("touchstart", handleFirstInteraction);
      document.removeEventListener("keydown", handleFirstInteraction);
    };
  }, [musicEnabled]);

  // Play/pause when musicEnabled toggles (after interaction)
  useEffect(() => {
    if (!hasInteracted) return;

    if (musicEnabled) {
      manager.current.play();
    } else {
      manager.current.pause();
    }
  }, [musicEnabled, hasInteracted]);

  // Switch track when phase changes
  useEffect(() => {
    manager.current.switchPhase(phase);
  }, [phase]);

  // Cleanup
  useEffect(() => {
    return () => manager.current.destroy();
  }, []);

  return (
    <SoundContext.Provider value={{ hasInteracted }}>
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => useContext(SoundContext);
