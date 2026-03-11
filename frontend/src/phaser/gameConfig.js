import Phaser from "phaser";
import EndlessRunnerScene from "./scenes/EndlessRunnerScene";

export function createGameConfig(parent, questionBank, slug, playerName) {
  return {
    type: Phaser.AUTO,
    width: 800,
    height: 640,
    parent,
    backgroundColor: "#13243a",
    physics: {
      default: "arcade",
      arcade: {
        debug: false
      }
    },
    scene: [new EndlessRunnerScene(questionBank, slug, playerName)]
  };
}
