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
 *
 * Owns all play/pause decisions internally.  React effects just sync
 * three pieces of state: unlocked (user interacted), musicEnabled, and
 * the current game phase.  Each setter calls play/pause as appropriate,
 * eliminating effect-ordering bugs.
 */
class AudioManager {
  private audio: HTMLAudioElement;
  private currentPhase: GamePhase | null = null;
  private gameplayIndex = 0;
  private _musicEnabled = true;
  private _unlocked = false;

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

  private get shouldPlay(): boolean {
    return this._unlocked && this._musicEnabled;
  }

  /**
   * Call from within a user-gesture handler (click/touch/keydown) to
   * satisfy browser autoplay policy and unmute + start audible playback.
   */
  unlock() {
    if (this._unlocked) return;
    this._unlocked = true;
    if (this._musicEnabled) {
      // Unmute — the track is already playing silently from switchPhase
      this.audio.muted = false;
      this.audio.play().catch(() => {});
    }
  }

  /** Sync the mute/unmute preference from the UI store. */
  setMusicEnabled(enabled: boolean) {
    this._musicEnabled = enabled;
    if (this.shouldPlay) {
      this.audio.muted = false;
      this.audio.play().catch(() => {});
    } else if (this._unlocked) {
      this.audio.pause();
    }
  }

  /** Switch to a new game phase (sets track src, auto-plays if allowed). */
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

    if (this.shouldPlay) {
      // Already unlocked and enabled — play audibly
      this.audio.muted = false;
      this.audio.play().catch(() => {});
    } else if (this._musicEnabled) {
      // Not yet unlocked — start playing MUTED so the track is buffered
      // and already at the right position when the user first interacts.
      // Browsers allow muted autoplay.
      this.audio.muted = true;
      this.audio.play().catch(() => {});
    }
  }

  destroy() {
    this.audio.pause();
    this.audio.src = "";
    // Reset so switchPhase re-applies the src after a StrictMode remount
    this.currentPhase = null;
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

  // Detect first user interaction — unlock audio in the gesture context
  useEffect(() => {
    if (hasInteracted) return;
    const handler = () => {
      setHasInteracted(true);
      manager.current.unlock();
    };
    document.addEventListener("click", handler);
    document.addEventListener("touchstart", handler);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("keydown", handler);
    };
  }, [hasInteracted]);

  // Sync musicEnabled preference into AudioManager
  useEffect(() => {
    manager.current.setMusicEnabled(musicEnabled);
  }, [musicEnabled]);

  // Sync game phase (sets track src, auto-plays if unlocked + enabled)
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
