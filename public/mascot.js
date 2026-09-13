// Pixel grid and animation adapted from the owner's public/404.html.
customElements.define('adam-robot',class extends HTMLElement{connectedCallback(){if(this.firstChild)return;this.innerHTML='<button class="robot-stage" type="button" aria-label="Give Adam a spin"><canvas aria-hidden="true"></canvas></button>';
  const canvas = this.querySelector('canvas');
  const stage  = this.querySelector('.robot-stage');
  if (!canvas || !stage) return;
  const ctx = canvas.getContext('2d');

  const S           = 4;
  const PAD         = 4;
  const ROBOT_COLS  = 9;
  const ROBOT_ROWS  = 14;
  const OX = PAD, OY = PAD;
  const B     = '#1e1d1b';
  const FROST = '#f7f7f5';
  const BLUE  = '#5bb4ff';

  // Stage = robot visual footprint only (layout anchor)
  stage.style.width  = (ROBOT_COLS * S) + 'px';
  stage.style.height = (ROBOT_ROWS * S) + 'px';

  // Canvas overflows stage in all directions for explosion room
  canvas.width  = (ROBOT_COLS + PAD * 2) * S;
  canvas.height = (ROBOT_ROWS + PAD * 2) * S;
  canvas.style.left = (-PAD * S) + 'px';
  canvas.style.top  = (-PAD * S) + 'px';
  canvas.style.cursor = 'pointer';

  const _ = null;
  const G = [
    [_,_,_,_,'A',_,_,_,_],
    [_,_,_,_,'B',_,_,_,_],
    [_,'B','B','B','B','B','B','B',_],
    ['B','B','B','B','B','B','B','B','B'],
    ['B','B','E','B','B','B','E','B','B'],
    ['B','B','B','B','B','B','B','B','B'],
    [_,'B','B','B','B','B','B','B',_],
    [_,_,'B','B','B','B','B',_,_],
    ['B','B','B','B','B','B','B','B','B'],
    ['B',_,'B','B','B','B','B',_,'B'],
    [_,_,'B','B','B','B','B',_,_],
    [_,_,'B','B',_,'B','B',_,_],
    [_,_,'B','B',_,'B','B',_,_],
    [_,_,'B','B',_,'B','B',_,_],
  ];

  let mode = 'idle', hover = false;
  let eyesOpen = true, blinkStart = null, nextBlink = 3000;
  const BLINK_DUR = 120;

  canvas.addEventListener('mouseenter', () => { hover = true;  if (mode === 'idle')  mode = 'hover'; });
  canvas.addEventListener('mouseleave', () => { hover = false; if (mode === 'hover') mode = 'idle';  });
  stage.addEventListener('click', () => {
    if (reduced.matches) return;
    if (mode === 'spinning') return;
    triggerSpin();
  });

  function triggerSpin() {
    mode = 'spinning';
    const anim = stage.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: 600, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
    );
    anim.onfinish = () => { mode = hover ? 'hover' : 'idle'; };
  }

  function drawIdleFrame(ts) {
    if (!blinkStart) blinkStart = ts;
    const be = ts - blinkStart;
    if (be > nextBlink + BLINK_DUR) { eyesOpen = true; blinkStart = ts; nextBlink = 2500 + Math.random()*3000; }
    else if (be > nextBlink) eyesOpen = false;

    const isHover   = mode === 'hover';
    const pulseSpd  = isHover ? 0.009 : 0.0025;
    const pulse     = (Math.sin(ts * pulseSpd) + 1) / 2;
    const av        = Math.round(70 + pulse * 130);
    const antennaC  = isHover
      ? `rgb(${Math.round(50+pulse*80)},${Math.round(140+pulse*80)},255)`
      : `rgb(${av},${av},${av})`;
    const eyeC      = eyesOpen ? (isHover ? BLUE : FROST) : B;

    const bob    = Math.sin(ts * (isHover ? 0.0028 : 0.0012)) * 2.5;
    const wiggle = isHover ? Math.sin(ts * 0.012) * 1.2 : 0;
    canvas.style.transform = `translate(${wiggle.toFixed(2)}px,${bob.toFixed(2)}px)`;

    for (let r = 0; r < ROBOT_ROWS; r++) {
      for (let c = 0; c < ROBOT_COLS; c++) {
        const cell = G[r][c];
        if (!cell) continue;
        ctx.fillStyle = cell === 'A' ? antennaC : cell === 'E' ? eyeC : B;
        ctx.fillRect((OX+c)*S, (OY+r)*S, S, S);
      }
    }
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function loop(ts) {
    if (!canvas.isConnected) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawIdleFrame(reduced.matches ? 0 : ts);
    if (!reduced.matches) requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}});
