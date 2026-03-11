import Phaser from "phaser";

const GAME_WIDTH = 800;
const GAME_HEIGHT = 640;
const LANE_COUNT = 3;
const PLAYER_Y = GAME_HEIGHT - 84;
const PLAYER_RADIUS = 22;
const OBSTACLE_SIZE = { width: 70, height: 70 };
const BASE_SPEED = 280;
const GATE_SPEED = 60;
const SPAWN_INTERVAL = 900;
const FIRST_QUESTION_SCORE = 50;
const QUESTION_INTERVAL = 100;
const LANE_CHANGE_DURATION = 130;
const SCORE_RATE = 10;
const GATE_WIDTH = 150;
const GATE_HEIGHT = 120;
const GATE_START_Y = -120;

export default class EndlessRunnerScene extends Phaser.Scene {
  constructor(questionBank, slug, playerName) {
    super("EndlessRunnerScene");
    this.questionBank = questionBank;
    this.slug = slug;
    this.playerName = playerName;
    this.obstacles = null;
    this.gates = null;
    this.player = null;
    this.playerVisual = null;
    this.scoreText = null;
    this.messageText = null;
    this.questionText = null;
    this.questionBackdrop = null;
    this.startOverlay = null;
    this.startOverlayButton = null;
    this.startOverlayLabel = null;
    this.trackLines = [];
    this.gateLabels = [];
    this.score = 0;
    this.isGameOver = false;
    this.currentLane = 1;
    this.lanePositions = [];
    this.scrollOffset = 0;
    this.spawnTimer = 0;
    this.gameMode = "idle";
    this.nextQuestionScore = QUESTION_INTERVAL;
    this.questionIndex = 0;
    this.hasSubmittedScore = false;
  }

  create() {
    this.cameras.main.setBackgroundColor("#13243a");
    this.lanePositions = this.getLanePositions();

    this.createTrack();
    this.createPlayer();
    this.createObstacles();
    this.createGates();
    this.createHud();
    this.createInput();
    this.createStartOverlay();
    this.resetRunState();

    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.handleResize, this);
    });
  }

  update(_, delta) {
    if (this.isGameOver || this.gameMode === "idle") {
      return;
    }

    const deltaSeconds = delta / 1000;
    this.score += deltaSeconds * SCORE_RATE;
    this.scoreText.setText(`Score: ${Math.floor(this.score)}`);

    this.scrollTrack(deltaSeconds);

    if (this.gameMode === "running") {
      this.moveObstacles(deltaSeconds);
      this.spawnTimer += delta;

      if (this.spawnTimer >= SPAWN_INTERVAL) {
        this.spawnObstacle();
        this.spawnTimer = 0;
      }

      if (this.score >= this.nextQuestionScore) {
        this.startQuestionRound();
      }
    }

    if (this.gameMode === "question") {
      this.moveGates(deltaSeconds);
    }
  }

  createTrack() {
    this.trackBackground = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH - 80,
      GAME_HEIGHT - 40,
      0x10263b
    );
    this.trackBackground.setStrokeStyle(4, 0x294e73, 0.9);

    const laneWidth = (GAME_WIDTH - 160) / LANE_COUNT;
    const top = 30;
    const height = GAME_HEIGHT - 60;

    for (let index = 0; index < LANE_COUNT + 1; index += 1) {
      const x = 80 + laneWidth * index;
      const divider = this.add.rectangle(x, GAME_HEIGHT / 2, 4, height, 0x315b82, 0.8);
      this.trackLines.push(divider);
    }

    this.dashGraphics = this.add.graphics();
    this.drawTrackDashes(top, height);
  }

  drawTrackDashes(top, height) {
    this.dashGraphics.clear();
    this.dashGraphics.fillStyle(0xf0b35d, 0.9);

    const laneWidth = (GAME_WIDTH - 160) / LANE_COUNT;
    const dividerXs = [80 + laneWidth, 80 + laneWidth * 2];

    dividerXs.forEach((x) => {
      for (let y = top + this.scrollOffset; y < top + height; y += 60) {
        this.dashGraphics.fillRect(x - 3, y, 6, 34);
      }
    });
  }

  createPlayer() {
    this.playerVisual = this.add.circle(
      this.lanePositions[this.currentLane],
      PLAYER_Y,
      PLAYER_RADIUS,
      0xf4f1ea
    );
    this.playerVisual.setStrokeStyle(5, 0xf0b35d, 1);

    this.player = this.physics.add.existing(this.playerVisual, false);
    this.player.body.setCircle(PLAYER_RADIUS);
    this.player.body.setAllowGravity(false);
    this.player.body.setImmovable(true);
  }

  createObstacles() {
    this.obstacles = this.physics.add.group({
      allowGravity: false,
      immovable: true
    });

    this.physics.add.overlap(this.player, this.obstacles, this.handleCollision, null, this);
  }

  createGates() {
    this.gates = this.physics.add.group({
      allowGravity: false,
      immovable: true
    });

    this.physics.add.overlap(this.player, this.gates, this.handleGateCollision, null, this);
  }

  createHud() {
    this.scoreText = this.add.text(28, 22, "Score: 0", {
      color: "#f4f1ea",
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "24px"
    });
    this.scoreText.setDepth(20);

    this.messageText = this.add.text(
      GAME_WIDTH / 2,
      96,
      "Arrow keys or A/D to switch lanes",
      {
        align: "center",
        color: "#d4deea",
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "20px"
      }
    );
    this.messageText.setDepth(20);
    this.messageText.setOrigin(0.5, 0);

    this.questionBackdrop = this.add.graphics();
    this.questionBackdrop.setDepth(18);
    this.questionBackdrop.setVisible(false);
    this.drawQuestionBackdrop();

    this.questionText = this.add.text(GAME_WIDTH / 2, 142, "", {
      align: "center",
      color: "#f0b35d",
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      wordWrap: { width: GAME_WIDTH - 140 }
    });
    this.questionText.setDepth(20);
    this.questionText.setOrigin(0.5, 0);
  }

  drawQuestionBackdrop() {
    this.questionBackdrop.clear();
    this.questionBackdrop.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.28, 0.28);
    this.questionBackdrop.fillRect(70, 122, GAME_WIDTH - 140, 92);
  }

  createInput() {
    this.input.keyboard.on("keydown-LEFT", () => this.tryMove(-1));
    this.input.keyboard.on("keydown-RIGHT", () => this.tryMove(1));
    this.input.keyboard.on("keydown-A", () => this.tryMove(-1));
    this.input.keyboard.on("keydown-D", () => this.tryMove(1));
    this.input.keyboard.on("keydown-SPACE", () => this.tryRestart());
    this.input.keyboard.on("keydown-ENTER", () => this.tryRestart());
  }

  createStartOverlay() {
    this.startOverlay = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.startOverlay.setDepth(40);

    const backdrop = this.add.rectangle(0, 0, 360, 220, 0x09111d, 0.92);
    backdrop.setStrokeStyle(3, 0xf0b35d, 0.9);

    const title = this.add.text(0, -62, "Math Runner", {
      color: "#f4f1ea",
      fontFamily: "Georgia, serif",
      fontSize: "34px"
    });
    title.setOrigin(0.5);

    this.startOverlayLabel = this.add.text(0, -12, "Press Start to begin", {
      align: "center",
      color: "#d4deea",
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "20px"
    });
    this.startOverlayLabel.setOrigin(0.5);

    this.startOverlayButton = this.add.rectangle(0, 58, 180, 54, 0xf0b35d, 1);
    this.startOverlayButton.setStrokeStyle(2, 0xf7d29b, 1);
    this.startOverlayButton.setInteractive({ useHandCursor: true });
    this.startOverlayButton.on("pointerdown", () => this.startRun());

    const buttonText = this.add.text(0, 58, "Start Run", {
      color: "#09111d",
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "24px",
      fontStyle: "bold"
    });
    buttonText.setOrigin(0.5);

    this.startOverlay.add([backdrop, title, this.startOverlayLabel, this.startOverlayButton, buttonText]);
  }

  resetRunState() {
    this.score = 0;
    this.hasSubmittedScore = false;
    this.isGameOver = false;
    this.currentLane = 1;
    this.spawnTimer = 0;
    this.scrollOffset = 0;
    this.gameMode = "idle";
    this.nextQuestionScore = FIRST_QUESTION_SCORE;
    this.scoreText.setText("Score: 0");
    this.messageText.setText("Arrow keys or A/D to switch lanes");
    this.questionText.setText("");
    this.questionBackdrop.setVisible(false);
    this.playerVisual.setPosition(this.lanePositions[this.currentLane], PLAYER_Y);
    this.player.body.reset(this.playerVisual.x, this.playerVisual.y);

    this.obstacles.clear(true, true);
    this.clearGates();
    this.drawTrackDashes(30, GAME_HEIGHT - 60);
  }

  startRun() {
    this.resetRunState();
    this.gameMode = "running";

    if (this.startOverlay) {
      this.startOverlay.setVisible(false);
    }
  }

  tryMove(direction) {
    if (this.isGameOver) {
      return;
    }

    const nextLane = Phaser.Math.Clamp(this.currentLane + direction, 0, LANE_COUNT - 1);

    if (nextLane === this.currentLane) {
      return;
    }

    this.currentLane = nextLane;
    const targetX = this.lanePositions[this.currentLane];

    this.tweens.killTweensOf(this.playerVisual);
    this.tweens.add({
      targets: this.playerVisual,
      x: targetX,
      duration: LANE_CHANGE_DURATION,
      ease: "Quad.Out",
      onUpdate: () => {
        this.player.body.reset(this.playerVisual.x, this.playerVisual.y);
      },
      onComplete: () => {
        this.player.body.reset(this.playerVisual.x, this.playerVisual.y);
      }
    });
  }

  spawnObstacle() {
    const laneIndex = Phaser.Math.Between(0, LANE_COUNT - 1);
    const obstacleY = -40;

    const nearestInLane = this.obstacles
      .getChildren()
      .filter((obstacle) => obstacle.getData("laneIndex") === laneIndex)
      .sort((first, second) => first.y - second.y)[0];

    if (nearestInLane && nearestInLane.y < 140) {
      return;
    }

    const obstacle = this.add.rectangle(
      this.lanePositions[laneIndex],
      obstacleY,
      OBSTACLE_SIZE.width,
      OBSTACLE_SIZE.height,
      0xcf5a43
    );
    obstacle.setStrokeStyle(4, 0x7d231d, 1);

    this.physics.add.existing(obstacle, false);
    obstacle.body.setAllowGravity(false);
    obstacle.body.setImmovable(true);
    obstacle.body.setSize(OBSTACLE_SIZE.width, OBSTACLE_SIZE.height);
    obstacle.setData("laneIndex", laneIndex);

    this.obstacles.add(obstacle);
  }

  moveObstacles(deltaSeconds) {
    this.obstacles.getChildren().forEach((obstacle) => {
      obstacle.y += BASE_SPEED * deltaSeconds;
      obstacle.body.updateFromGameObject();

      if (obstacle.y > GAME_HEIGHT + 60) {
        obstacle.destroy();
      }
    });
  }

  moveGates(deltaSeconds) {
    this.gates.getChildren().forEach((gate) => {
      gate.y += GATE_SPEED * deltaSeconds;
      gate.body.updateFromGameObject();

      const label = gate.getData("label");

      if (label) {
        label.setPosition(gate.x, gate.y);
      }

      if (gate.y > GAME_HEIGHT + 80) {
        gate.destroy();

        if (label) {
          label.destroy();
        }
      }
    });
  }

  scrollTrack(deltaSeconds) {
    this.scrollOffset += BASE_SPEED * deltaSeconds * 0.6;
    this.scrollOffset %= 60;
    this.drawTrackDashes(30, GAME_HEIGHT - 60);
  }

  handleCollision() {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.gameMode = "gameOver";
    this.messageText.setText("Game Over\nPress Space or Enter to restart");
    this.questionText.setText("");
    this.questionBackdrop.setVisible(false);
    this.submitScore();
  }

  handleGateCollision(_, gate) {
    if (this.isGameOver || this.gameMode !== "question") {
      return;
    }

    if (gate.getData("isCorrect")) {
      this.finishQuestionRound();
      return;
    }

    this.handleCollision();
  }

  tryRestart() {
    if (!this.isGameOver) {
      return;
    }

    this.startRun();
  }

  handleResize(gameSize) {
    const { width, height } = gameSize;
    const scaleX = width / GAME_WIDTH;
    const scaleY = height / GAME_HEIGHT;

    this.cameras.main.setViewport(0, 0, width, height);
    this.cameras.main.setZoom(Math.min(scaleX, scaleY));
  }

  getLanePositions() {
    const leftBound = 80;
    const trackWidth = GAME_WIDTH - 160;
    const laneWidth = trackWidth / LANE_COUNT;

    return Array.from({ length: LANE_COUNT }, (_, index) => leftBound + laneWidth * (index + 0.5));
  }

  startQuestionRound() {
    this.gameMode = "question";
    this.nextQuestionScore += QUESTION_INTERVAL;
    this.spawnTimer = 0;
    this.obstacles.clear(true, true);
    this.clearGates();

    const question = this.getNextQuestion();
    this.messageText.setText("Choose the correct answer gate");
    this.questionBackdrop.setVisible(true);
    this.questionText.setText(question.question);

    const answers = Phaser.Utils.Array.Shuffle(
      question.answers.map((answer, index) => ({
        label: String(answer),
        isCorrect: index === 0
      }))
    );

    answers.forEach((answer, laneIndex) => {
      const gate = this.add.rectangle(
        this.lanePositions[laneIndex],
        GATE_START_Y,
        GATE_WIDTH,
        GATE_HEIGHT,
        0x295f88
      );
      gate.setStrokeStyle(5, 0xc8d8ea, 1);

      const label = this.add.text(gate.x, gate.y, answer.label, {
        align: "center",
        color: "#f4f1ea",
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "30px"
      });
      label.setDepth(15);
      label.setOrigin(0.5);

      this.physics.add.existing(gate, false);
      gate.body.setAllowGravity(false);
      gate.body.setImmovable(true);
      gate.body.setSize(GATE_WIDTH, GATE_HEIGHT);
      gate.setData("isCorrect", answer.isCorrect);
      gate.setData("label", label);

      this.gates.add(gate);
      this.gateLabels.push(label);
    });
  }

  finishQuestionRound() {
    this.gameMode = "running";
    this.messageText.setText("Correct! Keep running");
    this.questionText.setText("");
    this.questionBackdrop.setVisible(false);
    this.clearGates();
  }

  clearGates() {
    this.gateLabels.forEach((label) => label.destroy());
    this.gateLabels = [];
    this.gates.clear(true, true);
  }

  getNextQuestion() {
    const questions = this.questionBank.questions;
    const question = questions[this.questionIndex % questions.length];
    this.questionIndex += 1;
    return question;
  }

  async submitScore() {
    if (this.hasSubmittedScore || !this.slug || !this.playerName) {
      return;
    }

    this.hasSubmittedScore = true;

    try {
      await fetch(`/submit-score/${encodeURIComponent(this.slug)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: this.playerName,
          score: Math.floor(this.score)
        })
      });
    } catch {
      // Ignore score submission errors for now so the game-over flow stays responsive.
    }
  }
}
