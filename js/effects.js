/*
 * 演出：効果音（WebAudio）・紙吹雪・トースト・モーダル・浮かぶ文字
 */
(function (AK) {
  'use strict';
  const { h } = AK;

  // ---------- 効果音（音声ファイル不要のシンセ音） ----------
  AK.Sound = {
    ctx: null,
    ensure() {
      if (!this.ctx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (C) this.ctx = new C();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, dur = 0.12, type = 'sine', delay = 0, vol = 0.16) {
      const c = this.ensure();
      if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    },
    play(name, combo = 0) {
      if (!AK.S || !AK.S.settings.sound) return;
      const T = this.tone.bind(this);
      switch (name) {
        case 'tap': T(660, 0.05, 'triangle', 0, 0.06); break;
        case 'correct': {
          const k = 1 + Math.min(combo, 12) * 0.06; // コンボが続くほど音程アップ
          T(784 * k, 0.1, 'triangle'); T(1175 * k, 0.2, 'triangle', 0.08);
          break;
        }
        case 'wrong': T(220, 0.22, 'sawtooth', 0, 0.08); T(160, 0.3, 'sawtooth', 0.12, 0.07); break;
        case 'chest': [0, 1, 2, 3].forEach((i) => T(380 + i * 90, 0.06, 'square', i * 0.08, 0.05)); break;
        case 'reveal': T(1046, 0.1, 'triangle'); T(1318, 0.1, 'triangle', 0.07); T(1568, 0.22, 'triangle', 0.14); break;
        case 'rare': [523, 659, 784, 1046, 1318].forEach((f, i) => T(f, 0.16, 'triangle', i * 0.07)); break;
        case 'ssr': [523, 659, 784, 1046, 784, 1046, 1318, 1568, 2093].forEach((f, i) => T(f, 0.22, 'square', i * 0.09, 0.08)); break;
        case 'levelup': [392, 523, 659, 784, 1046].forEach((f, i) => T(f, 0.18, 'triangle', i * 0.1)); T(1046, 0.6, 'triangle', 0.55); T(1318, 0.6, 'triangle', 0.55, 0.1); break;
        case 'harvest': T(988, 0.08, 'sine', 0, 0.2); T(1318, 0.14, 'sine', 0.06, 0.2); break;
        case 'coin': T(1318, 0.06, 'square', 0, 0.05); T(1760, 0.12, 'square', 0.05, 0.05); break;
        case 'place': T(300, 0.08, 'sine', 0, 0.2); T(450, 0.07, 'sine', 0.05, 0.14); break;
        case 'combo': [0, 1, 2, 3].forEach((i) => T(600 + i * 200 + combo * 15, 0.08, 'square', i * 0.05, 0.06)); break;
        case 'bug': T(140, 0.15, 'sawtooth', 0, 0.06); T(180, 0.15, 'sawtooth', 0.1, 0.06); break;
        default: break;
      }
    },
  };

  // ---------- 紙吹雪（canvas） ----------
  AK.FX = {
    canvas: null, ctx: null, parts: [], running: false,
    init() {
      this.canvas = document.getElementById('fx');
      this.ctx = this.canvas.getContext('2d');
      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = innerWidth * dpr;
        this.canvas.height = innerHeight * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      addEventListener('resize', resize);
      resize();
    },
    confetti(n = 80, opts = {}) {
      const colors = opts.colors || ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'];
      const x = opts.x != null ? opts.x : innerWidth / 2;
      const y = opts.y != null ? opts.y : innerHeight / 3;
      const sp = opts.spread || 12;
      for (let i = 0; i < n; i++) {
        this.parts.push({
          x, y,
          vx: (Math.random() - 0.5) * sp * 1.4,
          vy: -Math.random() * sp - 3,
          size: 5 + Math.random() * 6,
          color: AK.rand(colors),
          rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
          life: 90 + Math.random() * 60,
          circle: Math.random() < 0.4,
        });
      }
      this.loop();
    },
    emoji(e, n = 8, x = innerWidth / 2, y = innerHeight / 2) {
      for (let i = 0; i < n; i++) {
        this.parts.push({
          x, y, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 3,
          size: 22 + Math.random() * 10, emoji: e, rot: 0, vr: (Math.random() - 0.5) * 0.2, life: 70,
        });
      }
      this.loop();
    },
    loop() {
      if (this.running) return;
      this.running = true;
      const step = () => {
        const c = this.ctx;
        c.clearRect(0, 0, innerWidth, innerHeight);
        for (const p of this.parts) {
          p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
          c.save();
          c.globalAlpha = Math.max(0, Math.min(1, p.life / 30));
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          if (p.emoji) {
            c.font = `${p.size}px serif`;
            c.textAlign = 'center';
            c.fillText(p.emoji, 0, 0);
          } else {
            c.fillStyle = p.color;
            if (p.circle) { c.beginPath(); c.arc(0, 0, p.size / 2, 0, Math.PI * 2); c.fill(); }
            else c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          }
          c.restore();
        }
        this.parts = this.parts.filter((p) => p.life > 0 && p.y < innerHeight + 60);
        if (this.parts.length) requestAnimationFrame(step);
        else { this.running = false; c.clearRect(0, 0, innerWidth, innerHeight); }
      };
      requestAnimationFrame(step);
    },
  };

  // ---------- UI 演出 ----------
  AK.centerOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  AK.floatText = function (text, x, y, cls = '') {
    const el = h('div', { class: 'float-text ' + cls }, text);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.append(el);
    setTimeout(() => el.remove(), 1300);
  };
  AK.bigText = function (text, cls = '') {
    const el = h('div', { class: 'big-text ' + cls }, text);
    document.body.append(el);
    setTimeout(() => el.remove(), 1400);
  };
  AK.flash = function (cls = '') {
    const el = h('div', { class: 'flash ' + cls });
    document.body.append(el);
    setTimeout(() => el.remove(), 700);
  };
  AK.toast = function (html, cls = '') {
    const el = h('div', { class: 'toast ' + cls, html });
    document.getElementById('toast-root').append(el);
    setTimeout(() => el.classList.add('out'), 3000);
    setTimeout(() => el.remove(), 3400);
  };

  /** モーダル。buttons: [{label, cls, onClick}]（onClick が false を返すと閉じない） */
  AK.modal = function ({ title, body, buttons, cls = '', dismissible = true } = {}) {
    const root = document.getElementById('modal-root');
    const back = h('div', { class: 'modal-back' });
    const box = h('div', { class: 'modal ' + cls });
    const close = () => {
      back.classList.add('out');
      setTimeout(() => back.remove(), 200);
    };
    if (title) box.append(h('h2', { class: 'modal-title' }, title));
    if (body != null) box.append(typeof body === 'string' ? h('div', { class: 'modal-body', html: body }) : h('div', { class: 'modal-body' }, body));
    const btns = h('div', { class: 'modal-btns' });
    (buttons || [{ label: 'OK', cls: 'primary' }]).forEach((b) => btns.append(h('button', {
      class: 'btn ' + (b.cls || ''),
      disabled: !!b.disabled,
      onclick: () => {
        AK.Sound.play('tap');
        if (b.onClick && b.onClick() === false) return;
        close();
      },
    }, b.label)));
    box.append(btns);
    back.append(box);
    if (dismissible) back.addEventListener('click', (e) => { if (e.target === back) close(); });
    root.append(back);
    return close;
  };
  /** エラーを画面に表示（真っ白で止まらないように。スクショで原因がわかるよう内容も出す） */
  AK.reportError = function (where, e) {
    const text = `${where}：${(e && (e.code || e.name)) || ''} ${(e && e.message) || e}`;
    console.error('[AK]', where, e);
    let box = document.getElementById('err-box');
    if (!box) {
      box = h('div', { id: 'err-box' },
        h('b', {}, '⚠️ エラーが発生しました'),
        h('pre', {}),
        h('div', {},
          h('button', { class: 'btn small', onclick: () => location.reload() }, '🔄 再読み込み'),
          h('button', { class: 'btn small', onclick: () => box.remove() }, 'とじる')));
      document.body.append(box);
    }
    box.querySelector('pre').textContent += text + '\n';
  };
  addEventListener('error', (e) => { if (e.message && !/ResizeObserver/.test(e.message)) AK.reportError('スクリプト', e.error || e.message); });
  addEventListener('unhandledrejection', (e) => AK.reportError('処理', e.reason));

  AK.confirm = (msg, onYes) => AK.modal({ body: msg, buttons: [{ label: 'やめる' }, { label: 'OK', cls: 'primary', onClick: onYes }] });
})(window.AK);
