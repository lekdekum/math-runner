import Phaser from "phaser";
import { buildApiUrl } from "../../auth";

const GAME_WIDTH = 800;
const GAME_HEIGHT = 640;
const LANE_COUNT = 3;
const COLOR_DARK_BLUE = 0x13243a;
const COLOR_PANEL_BLUE = 0x09111d;
const COLOR_TRACK_BLUE = 0x10263b;
const COLOR_DETAIL_BLUE = 0x315b82;
const COLOR_LIGHT_BLUE = 0xc8d8ea;
const COLOR_OFF_WHITE = 0xf4f1ea;
const COLOR_YELLOW = 0xf0b35d;
const COLOR_YELLOW_LIGHT = 0xf7d29b;
const COLOR_OBSTACLE = 0xcf5a43;
const COLOR_OBSTACLE_BORDER = 0x7d231d;
const COLOR_BLACK = 0x000000;
const COLOR_GATE_BLUE = 0x295f88;
const PLAYER_Y = GAME_HEIGHT - 84;
const PLAYER_RADIUS = 22;
const OBSTACLE_SIZE = { height: 70 };
const OBSTACLE_LANE_WIDTH_RATIO = 0.8;
const BASE_SPEED = 280;
const MAX_GATE_SPEED = 200;
const MIN_GATE_SPEED = 30;
const SPAWN_INTERVAL_SLOW = 1300;
const SPAWN_INTERVAL_MEDIUM = 900;
const SPAWN_INTERVAL_FAST = 750;
const FIRST_QUESTION_SCORE = 50;
const QUESTION_INTERVAL = 100;
const LANE_CHANGE_DURATION = 130;
const SCORE_RATE = 10;
const GATE_WIDTH = 150;
const GATE_HEIGHT = 120;
const GATE_START_Y = -120;
const OBJECT_SCORE_RAMPUP = 200;
const OBJECT_SCORE_FULL_SINGLE = 600;
const OBJECT_SCORE_DOUBLE_EASY = 900;
const OBJECT_CHANCE_EASY = 0.2;
const OBJECT_CHANCE_HARD_BASE = 0.4;
const OBJECT_CHANCE_HARD_STEP = 0.1;
const OBJECT_CHANCE_HARD_SCORE_STEP = 100;
const QUICK_MESSAGE_HOLD_MS = 700;
const QUICK_MESSAGE_FADE_MS = 250;

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
    this.scoreBackdrop = null;
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
    this.cameras.main.setBackgroundColor(COLOR_DARK_BLUE);
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
    this.scoreText.setText(`SCORE: ${Math.floor(this.score)}`);

    this.scrollTrack(deltaSeconds);

    if (this.gameMode === "running") {
      this.moveObstacles(deltaSeconds);
      this.spawnTimer += delta;

      if (this.score <= OBJECT_SCORE_RAMPUP){
        if(this.spawnTimer >= SPAWN_INTERVAL_SLOW){
          this.spawnObstacle();
        }
      }else if (this.score<=OBJECT_SCORE_FULL_SINGLE){
        if(this.spawnTimer >= SPAWN_INTERVAL_MEDIUM){
          this.spawnObstacle();
        }
      }else if(this.score<=OBJECT_SCORE_DOUBLE_EASY){
        if(this.spawnTimer >= SPAWN_INTERVAL_MEDIUM){
          const aux = Math.random();
          if(aux<OBJECT_CHANCE_EASY){
            this.spawnObstacleDouble();
          }else{
            this.spawnObstacle();
          }
        }
      }else{
        if(this.spawnTimer >= SPAWN_INTERVAL_FAST){
          const aux = Math.random();
          if(aux<this.getHardPhaseDoubleChance()){
            this.spawnObstacleDouble();
          }else{
            this.spawnObstacle();
          }
        }
      }

      if (this.score >= this.nextQuestionScore) {
        this.startQuestionRound();
      }
    }

    if (this.gameMode === "question") {
      this.moveObstacles(deltaSeconds);
      this.moveGates(deltaSeconds);
    }
  }

  createTrack() {
    this.trackBackground = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH - 80,
      GAME_HEIGHT - 40,
      COLOR_TRACK_BLUE
    );
    this.trackBackground.setStrokeStyle(4, COLOR_DETAIL_BLUE, 0.9);

    const laneWidth = (GAME_WIDTH - 160) / LANE_COUNT;
    const top = 30;
    const height = GAME_HEIGHT - 60;

    for (let index = 0; index < LANE_COUNT + 1; index += 1) {
      const x = 80 + laneWidth * index;
      const divider = this.add.rectangle(x, GAME_HEIGHT / 2, 4, height, COLOR_DETAIL_BLUE, 0.8);
      this.trackLines.push(divider);
    }

    this.dashGraphics = this.add.graphics();
    this.drawTrackDashes(top, height);
  }

  drawTrackDashes(top, height) {
    this.dashGraphics.clear();
    this.dashGraphics.fillStyle(COLOR_TRACK_BLUE, 0.9);

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
      COLOR_OFF_WHITE
    );
    this.playerVisual.setStrokeStyle(5, COLOR_YELLOW, 1);

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
    this.scoreBackdrop = this.add.graphics();
    this.scoreBackdrop.setDepth(18);
    this.scoreBackdrop.fillStyle(COLOR_PANEL_BLUE, 0.88);
    this.scoreBackdrop.lineStyle(3, COLOR_DETAIL_BLUE, 0.95);
    this.scoreBackdrop.fillRoundedRect(3, GAME_HEIGHT - 50, 176, 48, 14);
    this.scoreBackdrop.strokeRoundedRect(3, GAME_HEIGHT - 50, 176, 48, 14);

    this.scoreText = this.add.text(16, GAME_HEIGHT - 35, "SCORE: 0", {
      color: Phaser.Display.Color.IntegerToColor(COLOR_OFF_WHITE).rgba,
      fontFamily: '"Minecraft", "Trebuchet MS", sans-serif',
      fontSize: "24px"
    });
    this.scoreText.setDepth(20);

    this.messageText = this.add.text(
      GAME_WIDTH / 2,
      74,
      "ARROW KEYS OR A/D TO SWITCH LANES",
      {
        align: "center",
        color: Phaser.Display.Color.IntegerToColor(COLOR_LIGHT_BLUE).rgba,
        fontFamily: '"Minecraft", "Trebuchet MS", sans-serif',
        fontSize: "20px",
        wordWrap: { width: GAME_WIDTH - 180 }
      }
    );
    this.messageText.setDepth(20);
    this.messageText.setOrigin(0.5);

    this.questionBackdrop = this.add.graphics();
    this.questionBackdrop.setDepth(18);
    this.questionBackdrop.setVisible(false);
    this.drawQuestionBackdrop();

    this.questionText = this.add.text(GAME_WIDTH / 2, 74, "", {
      align: "center",
      color: Phaser.Display.Color.IntegerToColor(COLOR_YELLOW).rgba,
      fontFamily: '"Minecraft", "Trebuchet MS", sans-serif',
      fontSize: "24px",
      wordWrap: { width: GAME_WIDTH - 180 }
    });
    this.questionText.setDepth(20);
    this.questionText.setOrigin(0.5);
  }

  drawQuestionBackdrop() {
    this.questionBackdrop.clear();
    this.questionBackdrop.fillStyle(COLOR_BLACK, 0.42);
    this.questionBackdrop.fillRect(90, 30, GAME_WIDTH - 180, 88);
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

    const backdrop = this.add.rectangle(0, 0, 360, 220, COLOR_PANEL_BLUE, 0.92);
    backdrop.setStrokeStyle(3, COLOR_YELLOW, 0.9);

    const title = this.add.text(0, -62, "Math Runner", {
      color: Phaser.Display.Color.IntegerToColor(COLOR_OFF_WHITE).rgba,
      fontFamily: "Georgia, serif",
      fontSize: "34px"
    });
    title.setShadow(0, 3, Phaser.Display.Color.IntegerToColor(COLOR_BLACK).rgba, 8, true, true);
    title.setOrigin(0.5);

    this.startOverlayLabel = this.add.text(0, -12, "PRESS START TO BEGIN", {
      align: "center",
      color: Phaser.Display.Color.IntegerToColor(COLOR_LIGHT_BLUE).rgba,
      fontFamily: '"Minecraft", "Trebuchet MS", sans-serif',
      fontSize: "20px"
    });
    this.startOverlayLabel.setOrigin(0.5);

    this.startOverlayButton = this.add.rectangle(0, 58, 180, 54, COLOR_YELLOW, 1);
    this.startOverlayButton.setStrokeStyle(2, COLOR_YELLOW_LIGHT, 1);
    this.startOverlayButton.setInteractive({ useHandCursor: true });
    this.startOverlayButton.on("pointerdown", () => this.startRun());

    const buttonText = this.add.text(0, 58, "START RUN", {
      color: Phaser.Display.Color.IntegerToColor(COLOR_PANEL_BLUE).rgba,
      fontFamily: '"Minecraft", "Trebuchet MS", sans-serif',
      fontSize: "24px"
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
    this.scoreText.setText("SCORE: 0");
    this.showMessage("ARROW KEYS OR A/D TO SWITCH LANES", {
      autoFade: true
    });
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
    if (this.spawnObstacleAtLane(laneIndex)) {
      this.spawnTimer = 0;
    }
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

  spawnObstacleDouble() {
    const emptyLaneIndex = Phaser.Math.Between(0, LANE_COUNT - 1);
    const occupiedLaneIndexes = Phaser.Utils.Array.NumberArray(0, LANE_COUNT - 1).filter(
      (laneIndex) => laneIndex !== emptyLaneIndex
    );

    if (!occupiedLaneIndexes.every((laneIndex) => this.canSpawnObstacleInLane(laneIndex))) {
      return;
    }

    occupiedLaneIndexes.forEach((laneIndex) => {
      this.spawnObstacleAtLane(laneIndex);
    });
    this.spawnTimer = 0;
  }

  moveGates(deltaSeconds) {

    const gateSpeed = this.calcGateSpeed();
    console.log(gateSpeed);
    this.gates.getChildren().forEach((gate) => {
      gate.y += gateSpeed * deltaSeconds;
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
    if (this.isGameOver || this.gameMode === "question") {
      return;
    }

    this.isGameOver = true;
    this.gameMode = "gameOver";
    this.showMessage("GAME OVER\nPRESS SPACE OR ENTER TO RESTART");
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

  getObstacleWidth() {
    return ((GAME_WIDTH - 160) / LANE_COUNT) * OBSTACLE_LANE_WIDTH_RATIO;
  }

  startQuestionRound() {
    this.gameMode = "question";
    this.nextQuestionScore += QUESTION_INTERVAL;
    this.spawnTimer = 0;
    this.obstacles.getChildren().forEach((obstacle) => {
      obstacle.setData("retiring", true);
    });
    this.clearGates();

    const question = this.getNextQuestion();
    this.questionBackdrop.setVisible(true);
    this.questionText.setText(String(question.question).toUpperCase());

    const answers = Phaser.Utils.Array.Shuffle(
      question.answers.map((answer, index) => ({
        label: String(answer).toUpperCase(),
        isCorrect: index === 0
      }))
    );

    answers.forEach((answer, laneIndex) => {
      const gate = this.add.rectangle(
        this.lanePositions[laneIndex],
        GATE_START_Y,
        GATE_WIDTH,
        GATE_HEIGHT,
        COLOR_GATE_BLUE
      );
      gate.setStrokeStyle(5, COLOR_LIGHT_BLUE, 1);

      const label = this.add.text(gate.x, gate.y, answer.label, {
        align: "center",
        color: Phaser.Display.Color.IntegerToColor(COLOR_OFF_WHITE).rgba,
        fontFamily: '"Minecraft", "Trebuchet MS", sans-serif',
        fontSize: "28px"
      });
      label.setDepth(15);
      label.setOrigin(0.5, 0.5);

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
    this.showMessage("CORRECT! KEEP RUNNING", {
      autoFade: true
    });
    this.questionText.setText("");
    this.questionBackdrop.setVisible(false);
    this.clearGates();
  }

  showMessage(message, options = {}) {
    const { autoFade = false } = options;

    this.tweens.killTweensOf(this.messageText);
    this.messageText.setAlpha(1);
    this.messageText.setText(message);

    if (!autoFade) {
      return;
    }

    this.tweens.add({
      targets: this.messageText,
      alpha: 0,
      delay: QUICK_MESSAGE_HOLD_MS,
      duration: QUICK_MESSAGE_FADE_MS*2,
      ease: "Quad.Out"
    });
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

  calcGateSpeed(){
    const terminal_score = 2000;
    const k = -Math.log(0.01)/terminal_score; //99% of MAX_GATE_SPEED when gets to terminal_score

    if (this.score < terminal_score){
      return MIN_GATE_SPEED + (MAX_GATE_SPEED - MIN_GATE_SPEED)*(1-Math.exp(-this.score*k));
    }
    return MAX_GATE_SPEED*this.score/terminal_score;
    
  }

  getHardPhaseDoubleChance() {
    const scoreOverThreshold = Math.max(0, this.score - OBJECT_SCORE_DOUBLE_EASY);
    const scoreSteps = Math.floor(scoreOverThreshold / OBJECT_CHANCE_HARD_SCORE_STEP);
    const chance = OBJECT_CHANCE_HARD_BASE + scoreSteps * OBJECT_CHANCE_HARD_STEP;

    return Math.min(1, chance);
  }

  canSpawnObstacleInLane(laneIndex) {
    const nearestInLane = this.obstacles
      .getChildren()
      .filter((obstacle) => obstacle.getData("laneIndex") === laneIndex)
      .sort((first, second) => first.y - second.y)[0];

    return !nearestInLane || nearestInLane.y >= 140;
  }

  spawnObstacleAtLane(laneIndex) {
    if (!this.canSpawnObstacleInLane(laneIndex)) {
      return false;
    }

    const obstacleWidth = this.getObstacleWidth();

    const obstacle = this.add.rectangle(
      this.lanePositions[laneIndex],
      -40,
      obstacleWidth,
      OBSTACLE_SIZE.height,
      COLOR_OBSTACLE
    );
    obstacle.setStrokeStyle(4, COLOR_OBSTACLE_BORDER, 1);

    this.physics.add.existing(obstacle, false);
    obstacle.body.setAllowGravity(false);
    obstacle.body.setImmovable(true);
    obstacle.body.setSize(obstacleWidth, OBSTACLE_SIZE.height);
    obstacle.setData("laneIndex", laneIndex);

    this.obstacles.add(obstacle);
    return true;
  }

  async submitScore() {
    if (this.hasSubmittedScore || !this.slug || !this.playerName) {
      return;
    }

    this.hasSubmittedScore = true;

    try {
      await fetch(buildApiUrl(`/submit-score/${encodeURIComponent(this.slug)}`), {
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
