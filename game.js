
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = canvas.width = 800;
const H = canvas.height = 450;

const paddle = {
  width: 12,
  height: 85,
  speed: 7
};

let left = { x: 25, y: 180 };
let right = { x: 763, y: 180 };

let ball = {
  x: W / 2,
  y: H / 2,
  vx: 5,
  vy: 3,
  radius: 9
};

let score = [0, 0];
const keys = {};

document.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

function update() {
  if (keys["w"]) left.y -= paddle.speed;
  if (keys["s"]) left.y += paddle.speed;
  if (keys["arrowup"]) right.y -= paddle.speed;
  if (keys["arrowdown"]) right.y += paddle.speed;

  left.y = Math.max(0, Math.min(H - paddle.height, left.y));
  right.y = Math.max(0, Math.min(H - paddle.height, right.y));

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.y < ball.radius || ball.y > H - ball.radius) {
    ball.vy *= -1;
  }

  if (
    ball.x - ball.radius < left.x + paddle.width &&
    ball.y > left.y &&
    ball.y < left.y + paddle.height &&
    ball.vx < 0
  ) ball.vx *= -1;

  if (
    ball.x + ball.radius > right.x &&
    ball.y > right.y &&
    ball.y < right.y + paddle.height &&
    ball.vx > 0
  ) ball.vx *= -1;

  if (ball.x < 0) {
    score[1]++;
    resetBall();
  }

  if (ball.x > W) {
    score[0]++;
    resetBall();
  }
}

function resetBall() {
  ball.x = W / 2;
  ball.y = H / 2;
  ball.vx *= -1;
  ball.vy = 3;
}

function draw() {
  ctx.fillStyle = "#176b42";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 10);
  ctx.lineTo(W / 2, H - 10);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "white";
  ctx.fillRect(left.x, left.y, paddle.width, paddle.height);
  ctx.fillRect(right.x, right.y, paddle.width, paddle.height);

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "32px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${score[0]}  -  ${score[1]}`, W / 2, 55);
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();

