// Visit counter
{
  const count = (parseInt(localStorage.getItem('hit-count'), 10) || 0) + 1;
  localStorage.setItem('hit-count', count);
  document.getElementById('hit-count').textContent = String(count).padStart(6, '0');
}

// Books 
{
  document.querySelectorAll('.books-sub').forEach((sub) => {
    const btn = sub.querySelector('.see-more');
    if (!sub.querySelector('.extra')) {
      btn.remove();
      return;
    }
    btn.addEventListener('click', () => {
      const open = sub.classList.toggle('expanded');
      btn.textContent = open ? 'see less ↑' : 'see more ↓';
    });
  });
}

// Photo walls 
// (photos: image URL strings, or null for a placeholder box).
{
  // each photo carries its real pixel size
  // to add a month run `python3 tools/add-photo.py <photo> <name>` for each photo, then append
  //  a new { label, photos } object to the END of the list below here
  const WALLS = [
    {
      label: 'july 2026',
      photos: [
        { src: 'images/wall/robot.jpg', w: 640, h: 850, caption: 'cubicle robot. made of nokia boxes.' },
        { src: 'images/wall/montreal.jpg', w: 640, h: 806, caption: 'montreal, from mont royal' },
      ],
    },
  ];
  let current = WALLS.length - 1;

  const photosEl = document.getElementById('wall-photos');
  const labelEl = document.getElementById('wall-label');
  const prevBtn = document.getElementById('wall-prev');
  const nextBtn = document.getElementById('wall-next');

  function showWall(i) {
    current = i;
    const wall = WALLS[i];
    labelEl.textContent = wall.label;
    photosEl.innerHTML = '';
    wall.photos.forEach((photo) => {
      if (!photo) {
        const box = document.createElement('div');
        box.className = 'photo-placeholder';
        box.textContent = 'photo soon';
        photosEl.appendChild(box);
        return;
      }

      const fig = document.createElement('figure');
      fig.className = photo.h > photo.w ? 'wall-figure portrait' : 'wall-figure landscape';

      const img = document.createElement('img');
      img.className = 'wall-photo';
      img.src = photo.src;
      img.width = photo.w;
      img.height = photo.h;
      img.loading = 'lazy';
      img.alt = photo.caption || `photo from ${wall.label}`;
      fig.appendChild(img);

      if (photo.caption) {
        const cap = document.createElement('figcaption');
        cap.textContent = photo.caption;
        fig.appendChild(cap);
      }
      photosEl.appendChild(fig);
    });
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === WALLS.length - 1;
  }

  prevBtn.addEventListener('click', () => showWall(current - 1));
  nextBtn.addEventListener('click', () => showWall(current + 1));
  showWall(current);
}

// --- Goose ---
// Snake, but Waterloo: steer the goose, eat crumbs, grow a line of
// gooselings behind you. Arrows / WASD, or swipe on touch screens.
{
  const canvas = document.getElementById('goose-canvas');
  const ctx = canvas.getContext('2d');

  const CELL = 32;
  const GRID = canvas.width / CELL; // 15x15
  const TICK_MS = 140;

  const scoreEl = document.getElementById('goose-score');
  const bestEl = document.getElementById('goose-best');
  let best = parseInt(localStorage.getItem('goose-best'), 10) || 0;
  bestEl.textContent = `best: ${best}`;

  let goose;      // [head, ...gooselings], each {x, y}
  let dir;        // current direction {x, y}
  let nextDir;    // buffered input, applied once per tick
  let crumb;      // {x, y}
  let score;
  let running = false;
  let timer = null;
  let plays = 0;
  let pink = false; // rare pink goose, 1 in 10 after your first game
  let bannerTicks = 0; // countdown for the pink goose announcement

  // --- leaderboard ---
  // Scores live in a Cloudflare Worker (see worker/). If it can't be reached the
  // game keeps working on a per-browser board, so the page never depends on it.
  const API = 'https://goose.erkambogoose.workers.dev';

  const BOARD_SIZE = 5;
  const BAD_INITIALS = [
    'ASS', 'FUK', 'FCK', 'FUC', 'FKU', 'SEX', 'KKK', 'FAG',
    'NIG', 'NGR', 'NGA', 'CUM', 'JIZ', 'DIK', 'DCK', 'COK',
    'COC', 'TIT', 'VAG', 'PNS', 'GOD', 'DIE', 'PEE',
  ];

  const boardEl = document.getElementById('goose-board');
  const entryForm = document.getElementById('goose-entry');
  const initialsInput = document.getElementById('goose-initials');
  let pendingScore = null;

  let scores = [];   // whatever we last saw; kept in memory so tick() stays sync
  let global = true; // false once we've fallen back to this browser's own board

  function localScores() {
    try {
      return JSON.parse(localStorage.getItem('goose-scores')) || [];
    } catch {
      return [];
    }
  }

  async function loadScores() {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(res.status);
      scores = await res.json();
      global = true;
    } catch {
      scores = localScores(); // offline, blocked, or not deployed yet
      global = false;
    }
    renderBoard();
  }

  async function saveScore(entry) {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error(res.status);
      scores = await res.json(); // the server decides the final board
      global = true;
    } catch {
      const local = localScores();
      local.push(entry);
      local.sort((a, b) => b.score - a.score);
      scores = local.slice(0, BOARD_SIZE);
      localStorage.setItem('goose-scores', JSON.stringify(scores));
      global = false;
    }
    renderBoard();
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    scores.forEach((s) => {
      const li = document.createElement('li');
      li.textContent = `${s.initials} ${String(s.score).padStart(3, ' ')}`;
      boardEl.appendChild(li);
    });
    // say so rather than passing a local board off as a global one
    boardEl.dataset.scope = global ? 'world' : 'this browser only';
  }

  function qualifies(s) {
    return s > 0 && (scores.length < BOARD_SIZE || s > scores[scores.length - 1].score);
  }

  entryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const initials = initialsInput.value.toUpperCase().trim();
    if (!/^[A-Z]{3}$/.test(initials)) {
      initialsInput.value = '';
      initialsInput.placeholder = 'A-Z';
      return;
    }
    if (BAD_INITIALS.includes(initials)) {
      initialsInput.value = '';
      initialsInput.placeholder = '*honk*';
      return;
    }
    entryForm.hidden = true;
    saveScore({ initials, score: pendingScore });
    pendingScore = null;
  });

  function reset() {
    goose = [{ x: 7, y: 7 }];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    scoreEl.textContent = 'crumbs: 0';
    dropCrumb();
  }

  function dropCrumb() {
    do {
      crumb = {
        x: Math.floor(Math.random() * GRID),
        y: Math.floor(Math.random() * GRID),
      };
    } while (goose.some((g) => g.x === crumb.x && g.y === crumb.y));
  }

  function tick() {
    dir = nextDir;
    const head = { x: goose[0].x + dir.x, y: goose[0].y + dir.y };

    const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
    const hitSelf = goose.some((g) => g.x === head.x && g.y === head.y);
    if (hitWall || hitSelf) return gameOver();

    goose.unshift(head);
    if (head.x === crumb.x && head.y === crumb.y) {
      score++;
      scoreEl.textContent = `crumbs: ${score}`;
      dropCrumb(); // keep the new gosling instead of dropping the tail
    } else {
      goose.pop();
    }
    draw();
  }

  function dot(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // crumb
    dot(crumb.x * CELL + CELL / 2, crumb.y * CELL + CELL / 2, 6, '#c9a227');

    // gooselings: round yellow fluffballs with a little face
    // pointing at whoever they're following
    for (let i = goose.length - 1; i > 0; i--) {
      const gx = goose[i].x * CELL + CELL / 2;
      const gy = goose[i].y * CELL + CELL / 2;
      const ahead = goose[i - 1];
      const fx = Math.sign(ahead.x - goose[i].x);
      const fy = Math.sign(ahead.y - goose[i].y);
      dot(gx, gy, 10, i % 2 ? '#d9c96a' : '#c4b455');
      dot(gx + fx * 6, gy + fy * 6, 3, '#7a6a2a');
    }

    // the goose: gray-brown body, long black head on the leading
    // edge, white Canada goose chinstrap where head meets body
    const hx = goose[0].x * CELL + CELL / 2;
    const hy = goose[0].y * CELL + CELL / 2;
    dot(hx - dir.x * 4, hy - dir.y * 4, 12, pink ? '#e8a0b8' : '#8f8672');
    dot(hx + dir.x * 10, hy + dir.y * 10, 8, pink ? '#a04a6a' : '#55584f'); // rim so the black head reads on the dark bg
    dot(hx + dir.x * 10, hy + dir.y * 10, 6.5, pink ? '#7a2a4a' : '#1e1e1c');
    dot(hx + dir.x * 15, hy + dir.y * 15, 3, pink ? '#d97b2a' : '#1e1e1c'); // beak
    dot(hx + dir.x * 6, hy + dir.y * 6, 3.2, '#f0f0f0'); // chinstrap

    if (bannerTicks > 0) {
      bannerTicks--;
      ctx.fillStyle = '#e8a0b8';
      ctx.font = 'bold 26px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('YOU ENCOUNTERED', canvas.width / 2, 60);
      ctx.fillText('A PINK GOOSE!', canvas.width / 2, 96);
    }
  }

  function drawIdle(lines) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#888888';
    ctx.font = '24px "Courier New", monospace';
    ctx.textAlign = 'center';
    lines.forEach((line, i) => {
      ctx.fillText(line, canvas.width / 2, canvas.height / 2 + i * 36 - 18);
    });
  }

  function start() {
    reset();
    pendingScore = null;
    entryForm.hidden = true;
    plays++;
    pink = plays > 1 && Math.random() < 0.1;
    bannerTicks = pink ? 14 : 0;
    running = true;
    timer = setInterval(tick, TICK_MS);
    draw();
  }

  function gameOver() {
    running = false;
    clearInterval(timer);
    if (score > best) {
      best = score;
      localStorage.setItem('goose-best', best);
      bestEl.textContent = `best: ${best}`;
    }
    if (qualifies(score)) {
      pendingScore = score;
      entryForm.hidden = false;
      initialsInput.value = '';
      initialsInput.placeholder = 'AAA';
      initialsInput.focus();
    }
    drawIdle(['*honk*', `${score} crumbs`, 'click to restart']);
  }

  function steer(x, y) {
    // no U-turns: a goose can't walk through its own gooselings
    if (goose.length > 1 && x === -dir.x && y === -dir.y) return;
    nextDir = { x, y };
  }

  const KEYS = {
    ArrowUp: [0, -1], w: [0, -1],
    ArrowDown: [0, 1], s: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0],
  };

  // keys only steer — starting is click/tap only, so a stray
  // keypress while reading the page doesn't launch the game
  document.addEventListener('keydown', (e) => {
    if (!running) return;
    const move = KEYS[e.key];
    if (move) {
      e.preventDefault(); // keep arrows from scrolling the page
      steer(move[0], move[1]);
    }
  });

  canvas.addEventListener('click', () => {
    if (!running) start();
  });

  // touch: tap to start, swipe to steer
  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    touchStart = e.touches[0];
    if (!running) start();
  });
  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.clientX;
    const dy = e.changedTouches[0].clientY - touchStart.clientY;
    if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
      if (Math.abs(dx) > Math.abs(dy)) steer(Math.sign(dx), 0);
      else steer(0, Math.sign(dy));
    }
    touchStart = null;
  });

  loadScores();
  drawIdle(['GOOSE', 'click to start']);
}
