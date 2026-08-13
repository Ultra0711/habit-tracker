let canvas, ctx;
let particles = [];
let running = false;

export function initConfetti() {
  canvas = document.getElementById('confettiCanvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

export function fireConfetti() {
  const colors = ['#6c5ce7', '#00b894', '#fdcb6e', '#ff6b6b', '#74b9ff', '#a29bfe'];
  const count = 90;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 120,
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -9 - 4,
      gravity: 0.28,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vr: (Math.random() - 0.5) * 14,
      life: 0,
      maxLife: 90 + Math.random() * 30,
      shape: Math.random() > 0.5 ? 'rect' : 'circle'
    });
  }
  if (!running) {
    running = true;
    requestAnimationFrame(animate);
  }
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.vy += p.gravity * 0.15;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.vr;
    p.life++;
    const alpha = Math.max(0, 1 - p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation * Math.PI / 180);
    ctx.fillStyle = p.color;
    if (p.shape === 'rect') {
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
  particles = particles.filter(p => p.life < p.maxLife);
  if (particles.length > 0) {
    requestAnimationFrame(animate);
  } else {
    running = false;
  }
}
