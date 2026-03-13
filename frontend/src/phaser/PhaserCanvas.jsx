import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { createGameConfig } from "./gameConfig";

export default function PhaserCanvas({ questionBank, slug, playerName }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !questionBank) {
      return undefined;
    }

    let game = null;
    let isDisposed = false;

    async function createGame() {
      try {
        await document.fonts.load('24px "Minecraft"');
      } catch {
        // Keep booting the game even if font loading is unsupported.
      }

      if (isDisposed || !containerRef.current) {
        return;
      }

      game = new Phaser.Game(createGameConfig(containerRef.current, questionBank, slug, playerName));
    }

    createGame();

    return () => {
      isDisposed = true;
      if (game) {
        game.destroy(true);
      }
    };
  }, [playerName, questionBank, slug]);

  return <div ref={containerRef} className="phaser-root" />;
}
