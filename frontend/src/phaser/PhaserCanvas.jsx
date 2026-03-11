import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { createGameConfig } from "./gameConfig";

export default function PhaserCanvas({ questionBank, slug, playerName }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !questionBank) {
      return undefined;
    }

    const game = new Phaser.Game(createGameConfig(containerRef.current, questionBank, slug, playerName));

    return () => {
      game.destroy(true);
    };
  }, [playerName, questionBank, slug]);

  return <div ref={containerRef} className="phaser-root" />;
}
