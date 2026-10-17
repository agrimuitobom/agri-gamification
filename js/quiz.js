/*
 * クイズ：修行 / 復習ノート / 鑑定競技 / 昇格試験 / 病害虫トラブル
 */
(function (AK) {
  'use strict';
  const { h } = AK;
  const LABELS = ['A', 'B', 'C', 'D'];
  const RANK_ORDER = { N: 0, R: 1, SR: 2, SSR: 3 };
  const COMBO_MILESTONES = [3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
  const MODE_TITLE = { train: '修行', review: '復習ノート', kantei: '鑑定競技', exam: '昇格試験', trouble: 'トラブル発生！', boss: 'ボス戦' };

  // ---------- 出題（同じ問題が続かないよう山札方式） ----------
  const decks = {};
  let byId = null;
  AK.qById = (id) => {
    if (!byId) { byId = {}; AK.QUESTIONS.forEach((q) => { byId[q.id] = q; }); }
    return byId[id];
  };
  function draw(field) {
    if (!decks[field] || !decks[field].length) {
      decks[field] = AK.shuffle(AK.QUESTIONS.filter((q) => field === 'mix' || q.f === field));
    }
    return decks[field].pop();
  }
  function drawMany(field, n) {
    const out = [], seen = new Set();
    for (let guard = 0; out.length < n && guard < 500; guard++) {
      const q = draw(field);
      if (!seen.has(q.id)) { seen.add(q.id); out.push(q); }
    }
    return out;
  }

  // ---------- ドロップ演出（宝箱 → カード） ----------
  AK.showDrops = function (container, drops, sub) {
    const chest = h('div', { class: 'chest' }, '🎁');
    const wrap = h('div', { class: 'drops' }, chest);
    container.append(wrap);
    if (sub) container.append(h('div', { class: 'reward-sub' }, sub));
    if (!drops.length) { wrap.remove(); return; }
    const best = drops.reduce((m, d) => Math.max(m, RANK_ORDER[AK.ITEMS[d.id].rarity]), 0);
    if (best >= 2) chest.classList.add(best === 3 ? 'glow-ssr' : 'glow-sr');
    AK.Sound.play('chest');
    setTimeout(() => {
      wrap.innerHTML = '';
      drops.forEach((d, i) => {
        const it = AK.ITEMS[d.id];
        wrap.append(h('div', { class: `card r-${it.rarity}${it.gold ? ' gold' : ''}`, style: { animationDelay: (i * 0.12) + 's' } },
          d.isNew ? h('div', { class: 'new' }, 'NEW!') : null,
          h('div', { class: 'c-emoji' }, it.emoji),
          h('div', { class: 'c-name' }, it.name),
          h('div', { class: 'c-rar' }, it.rarity)));
      });
      if (!wrap.isConnected) return;
      const c = AK.centerOf(wrap);
      if (best === 3) {
        AK.Sound.play('ssr'); AK.flash('gold'); AK.bigText('LEGEND!!', 'legend');
        AK.FX.confetti(180, { x: c.x, y: c.y, colors: ['#ffd700', '#fff6a5', '#ffb300', '#ffffff', '#ff7af6'] });
      } else if (best === 2) {
        AK.Sound.play('rare'); AK.bigText('SUPER RARE!', 'sr');
        AK.FX.confetti(80, { x: c.x, y: c.y, colors: ['#c084fc', '#a855f7', '#f0abfc', '#ffffff'] });
      } else if (best === 1) {
        AK.Sound.play('reveal');
        AK.FX.confetti(30, { x: c.x, y: c.y, colors: ['#60a5fa', '#93c5fd', '#ffffff'] });
      } else AK.Sound.play('reveal');
    }, best >= 2 ? 1100 : 550);
  };
  AK.rollAndGive = function (n, field, combo) {
    const drops = [];
    for (let i = 0; i < n; i++) {
      const id = AK.rollDrop(field, combo);
      drops.push({ id, isNew: AK.addItem(id) });
    }
    return drops;
  };

  // ---------- セッション ----------
  let s = null, root = null, timer = null, keyHandler = null;

  function start(opts) {
    root = document.getElementById('quiz-root');
    let queue = opts.queue || null;
    if (opts.mode === 'kantei') {
      // 全分野から均等に20問
      const fs = Object.keys(AK.FIELDS), per = Math.floor(20 / fs.length);
      queue = fs.flatMap((f) => drawMany(f, per));
      const seen = new Set(queue.map((q) => q.id));
      for (let guard = 0; queue.length < 20 && guard < 200; guard++) { const q = draw('mix'); if (!seen.has(q.id)) { seen.add(q.id); queue.push(q); } }
      queue = AK.shuffle(queue);
    }
    if (opts.mode === 'exam') queue = drawMany('mix', opts.count || 5);
    if (opts.mode === 'trouble') queue = drawMany(opts.field, 1);
    s = {
      opts, mode: opts.mode, field: opts.field || 'mix', queue,
      total: queue ? queue.length : Infinity,
      idx: 0, correct: 0, combo: 0, maxCombo: 0, results: [],
    };
    if (opts.mode === 'boss') {
      const b = AK.bossToday();
      s.field = b.field;
      s.boss = Object.assign(b, { max: b.hp });
      s.hearts = 3;
    }
    root.className = 'open';
    keyHandler = onKey;
    document.addEventListener('keydown', keyHandler);
    renderQ();
  }

  function close() {
    clearTimer();
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
    root.className = '';
    root.innerHTML = '';
    const o = s && s.opts;
    s = null;
    AK.save();
    AK.emit('change');
    if (o && o.onClose) o.onClose();
  }

  function quit() {
    if (!s) return;
    if ((s.mode === 'kantei' || s.mode === 'exam' || s.mode === 'boss') && s.results.length) {
      AK.confirm('途中でやめますか？（結果は記録されません）', close);
      return;
    }
    if ((s.mode === 'train' || s.mode === 'review') && s.results.length) {
      AK.toast(`今回の成績：${s.results.length}問中 ${s.correct}問正解／最大 ${s.maxCombo}コンボ`);
    }
    close();
  }

  function onKey(e) {
    if (!s || document.querySelector('.modal-back')) return;
    if (!s.answered && s.choices) {
      const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
      if (i >= 0 && s.choices[i]) { e.preventDefault(); answer(s.choices[i]); }
    } else if (s.next && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      s.next();
    }
  }

  function renderQ() {
    clearTimer();
    const q = s.queue ? s.queue[s.idx] : draw(s.field);
    s.q = q;
    s.answered = false;
    s.next = null;
    s.choices = AK.shuffle(q.c.map((t, i) => ({ t, ok: i === 0 })));
    s.shownAt = Date.now();
    const F = AK.FIELDS[q.f];

    root.innerHTML = '';
    root.classList.toggle('fever', s.combo >= 5);
    const head = h('div', { class: 'q-head' },
      h('button', { class: 'q-quit', onclick: quit, 'aria-label': 'やめる' }, '✕'),
      h('div', { class: 'q-title' }, s.opts.title || MODE_TITLE[s.mode]),
      h('div', { class: 'q-prog' }, s.queue ? `${s.idx + 1} / ${s.total}` : `第${s.idx + 1}問`));
    s.comboEl = h('div', { class: 'q-combo' });
    updateCombo();
    const timerBar = s.mode === 'kantei' ? h('div', { class: 'q-timer' }, h('i')) : null;
    const card = h('div', { class: 'q-card' },
      h('div', { class: 'q-field', style: { background: F.color } }, `${F.icon} ${F.name}`),
      s.opts.intro && s.idx === 0 ? h('div', { class: 'q-intro' }, s.opts.intro) : null,
      q.img ? h('img', { class: 'q-img', src: q.img, alt: '' }) : null,
      h('div', { class: 'q-text' }, q.q));
    const list = h('div', { class: 'q-choices' });
    s.choices.forEach((c, i) => {
      c.el = h('button', { class: 'choice', onclick: () => answer(c) },
        h('span', { class: 'lbl' }, LABELS[i]), h('span', { class: 'txt' }, c.t));
      list.append(c.el);
    });
    s.fb = h('div', { class: 'q-feedback' });
    const body = h('div', { class: 'q-body' }, s.boss ? bossPanel() : null, s.comboEl, timerBar, card, list, s.fb);
    root.append(head, body);
    if (timerBar) startTimer(timerBar.firstChild);
  }

  function bossPanel() {
    const b = s.boss;
    s.bossEmoji = h('div', { class: 'boss-emoji' }, b.emoji);
    s.hpBar = h('i', { style: { width: (b.hp / b.max * 100) + '%' } });
    s.hpText = h('span', {}, `${Math.max(0, b.hp)} / ${b.max}`);
    s.heartEl = h('div', { class: 'hearts' }, '❤️'.repeat(s.hearts) + '🖤'.repeat(3 - s.hearts));
    return h('div', { class: 'boss-panel' }, s.bossEmoji,
      h('div', { class: 'boss-info' },
        h('div', { class: 'boss-name' }, b.name, s.hpText),
        h('div', { class: 'hpbar' }, s.hpBar),
        s.heartEl));
  }
  function updateBoss() {
    const b = s.boss;
    s.hpBar.style.width = Math.max(0, b.hp / b.max * 100) + '%';
    s.hpText.textContent = `${Math.max(0, b.hp)} / ${b.max}`;
    s.heartEl.textContent = '❤️'.repeat(s.hearts) + '🖤'.repeat(3 - s.hearts);
  }
  function bossHit(ok) {
    const at = AK.centerOf(s.bossEmoji);
    if (ok) {
      const crit = Math.random() < 0.15;
      const dmg = (20 + Math.min(s.combo, 10) * 3) * (crit ? 2 : 1);
      s.boss.hp -= dmg;
      s.bossEmoji.classList.remove('hit'); void s.bossEmoji.offsetWidth; s.bossEmoji.classList.add('hit');
      AK.floatText(crit ? `会心の一撃！ -${dmg}` : `-${dmg}`, at.x, at.y, crit ? 'crit' : 'dmg');
      if (crit) AK.flash('');
      if (s.boss.hp <= 0) {
        s.bossEmoji.classList.add('down');
        setTimeout(() => { AK.Sound.play('ssr'); AK.bigText('討伐成功！', 'legend'); AK.FX.confetti(150); }, 300);
      }
    } else {
      s.hearts--;
      AK.flash('red');
      AK.floatText(`${s.boss.emoji}の反撃！`, innerWidth / 2, at.y + 40, 'dmg');
    }
    updateBoss();
  }

  function startTimer(bar) {
    const limit = s.opts.timeLimit || 20;
    const t0 = Date.now();
    timer = setInterval(() => {
      const r = 1 - (Date.now() - t0) / 1000 / limit;
      bar.style.width = Math.max(0, r * 100) + '%';
      bar.classList.toggle('low', r < 0.3);
      if (r <= 0) { clearTimer(); answer(null); }
    }, 100);
  }
  function clearTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function updateCombo() {
    const c = s.combo;
    s.comboEl.className = 'q-combo' + (c >= 5 ? ' hot' : '');
    s.comboEl.textContent = c >= 2 ? `🔥 ${c} COMBO${c >= 5 ? '　FEVER中！報酬2倍' : ''}` : '';
  }

  function answer(c) {
    if (!s || s.answered) return;
    s.answered = true;
    clearTimer();
    const q = s.q, ok = !!(c && c.ok), S = AK.S;
    // 連打対策：問題文を読む時間がないほど早い回答は報酬なし（修行・復習のみ）
    s.tooFast = (s.mode === 'train' || s.mode === 'review') && Date.now() - s.shownAt < 1200;
    if (s.mode === 'train' || s.mode === 'review') AK.pushRecent(ok && !s.tooFast);
    s.choices.forEach((x) => { x.el.disabled = true; if (x.ok) x.el.classList.add('correct'); });
    if (c && !ok) c.el.classList.add('wrong');

    S.stats.answered++;
    S.stats.byField[q.f].a++;
    const ql = S.qlog[q.id] || (S.qlog[q.id] = [0, 0]);
    ql[0]++;
    if (!ok) ql[1]++;
    s.results.push({ q, ok, chosen: c ? c.t : '（時間切れ）' });
    const at = c ? AK.centerOf(c.el) : { x: innerWidth / 2, y: innerHeight / 2 };

    if (ok) {
      s.correct++;
      if (!s.tooFast) s.combo++;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      S.stats.correct++;
      S.stats.byField[q.f].c++;
      S.stats.bestCombo = Math.max(S.stats.bestCombo, s.combo);
      if (s.mode === 'review' && S.wrong.includes(q.id) && !s.tooFast) {
        s.graduated = AK.reviewCorrect(q.id);
        AK.track('review');
      }
      AK.track('correct');
      AK.track('correct_' + q.f);
      AK.track('combo', s.combo);
      AK.Sound.play('correct', s.combo);
      if (s.mode !== 'kantei') {
        const label = s.mode !== 'review' || s.tooFast ? '正解！' : s.graduated ? '🎓 卒業！' : `復習 ${AK.reviewStage(q.id)}/${AK.REVIEW_GOAL}`;
        AK.floatText(label, at.x, at.y - 20, 'good');
      }
      AK.FX.confetti(16 + Math.min(s.combo, 10) * 4, { x: at.x, y: at.y, spread: 8 });
      comboEffects();
    } else {
      s.combo = 0;
      AK.reviewAdd(q.id);
      AK.Sound.play('wrong');
      root.classList.remove('fever');
      root.classList.add('shake');
      setTimeout(() => root.classList.remove('shake'), 400);
    }
    updateCombo();
    if (s.boss) bossHit(ok);
    afterAnswer(ok);
    AK.save();
    AK.emit('change');
  }

  function comboEffects() {
    const c = s.combo;
    if (!COMBO_MILESTONES.includes(c)) return;
    setTimeout(() => {
      AK.Sound.play('combo', c);
      if (c === 5) {
        AK.bigText('🔥FEVER!!🔥', 'fever');
        root.classList.add('fever');
      } else AK.bigText(`${c} COMBO!`, c >= 10 ? 'mega' : '');
      if (c >= 10) AK.flash('');
    }, 250);
  }

  function afterAnswer(ok) {
    const q = s.q;
    if (s.mode === 'kantei') {
      AK.bigText(ok ? '⭕' : '❌', 'mark ' + (ok ? 'good' : 'bad'));
      s.next = advance;
      setTimeout(() => { if (s && s.next === advance) advance(); }, 800);
      return;
    }
    const fb = s.fb;
    fb.append(
      h('div', { class: 'verdict ' + (ok ? 'ok' : 'ng') }, ok ? '⭕ 正解！' : '❌ 不正解…'),
      h('div', { class: 'explain' }, h('b', {}, '💡 解説　'), q.e));
    if (ok && (s.mode === 'train' || s.mode === 'review')) {
      if (s.tooFast) fb.append(h('div', { class: 'warn-box' }, '⚡ 早押しすぎ！問題文をよく読んでから答えよう（今回は報酬なし）'));
      else giveRewards(fb);
    }
    if (ok && s.mode === 'review' && !s.tooFast) {
      fb.append(h('div', { class: 'note' }, s.graduated ? '🎓 3回正解したので、この問題は復習ノートを卒業！'
        : `📕 復習 ${AK.reviewStage(q.id)}/${AK.REVIEW_GOAL} 回目クリア。${AK.fmtWait(AK.REVIEW_WAIT[AK.reviewStage(q.id)])}後にもう一度出題されます`));
    }
    if (!ok && !s.boss) fb.append(h('div', { class: 'note' }, s.mode === 'review' ? '📕 復習ノートの最初（0/3）からやり直し' : '📕 復習ノートに追加しました'));
    if (s.mode === 'trouble' && !ok) fb.append(h('div', { class: 'note' }, '病害虫はまだ残っている…。もう一度タップして再挑戦しよう！'));

    let label = '次の問題 ▶';
    if (s.mode === 'trouble') label = '王国にもどる';
    else if (s.boss) label = s.boss.hp <= 0 ? '🏆 報酬を受け取る' : s.hearts <= 0 ? '結果を見る' : '次の攻撃 ⚔️';
    else if (s.queue && s.idx >= s.total - 1) label = '結果を見る ▶';
    const btn = h('button', { class: 'btn primary big next-btn', onclick: () => s && s.next && s.next() }, label);
    fb.append(btn);
    // 連打対策：まちがえたら解説を読む時間（3秒）は次に進めない
    if (!ok) {
      let left = 3;
      btn.disabled = true;
      btn.textContent = `解説を読もう… ${left}`;
      const t = setInterval(() => {
        left--;
        if (!s || !btn.isConnected) { clearInterval(t); return; }
        if (left > 0) { btn.textContent = `解説を読もう… ${left}`; return; }
        clearInterval(t);
        btn.disabled = false;
        btn.textContent = label;
        s.next = advance;
      }, 1000);
    } else s.next = advance;
    setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  }

  function giveRewards(fb) {
    // 連打対策：最近の正答率が低いときはアイテムなし・報酬ダウン
    if (AK.lowAccuracy()) {
      AK.addCoins(1);
      AK.addXP(5);
      fb.append(h('div', { class: 'warn-box' }, '🐢 最近の正答率が低いので報酬ダウン中（アイテムなし）。解説をよく読んで、正答率4割以上をめざそう！'),
        h('div', { class: 'reward-sub' }, '+5 XP　+1 💰'));
      return;
    }
    const fever = s.combo >= 5;
    const xp = 10 + Math.min(s.combo, 10) * 2 + (s.mode === 'review' ? 15 : 0);
    const coins = fever ? 6 : 3;
    const drops = AK.rollAndGive(fever ? 2 : 1, s.q.f, s.combo + (s.mode === 'review' ? 5 : 0));
    AK.addCoins(coins);
    const box = h('div', { class: 'reward' });
    fb.append(box);
    AK.showDrops(box, drops, `+${xp} XP　+${coins} 💰${fever ? '　（FEVER 2倍！）' : ''}`);
    AK.addXP(xp);
  }

  function advance() {
    if (!s) return;
    s.next = null;
    if (s.mode === 'trouble') {
      const ok = s.results[0].ok, o = s.opts;
      close();
      if (o.onDone) o.onDone(ok);
      return;
    }
    s.idx++;
    if (s.boss && (s.boss.hp <= 0 || s.hearts <= 0)) { finishBoss(s.boss.hp <= 0); return; }
    if (s.queue && s.idx >= s.total) { finish(); return; }
    renderQ();
  }

  // ---------- 結果画面 ----------
  function resultScreen(...nodes) {
    root.innerHTML = '';
    root.classList.remove('fever');
    root.append(h('div', { class: 'q-head' }, h('div', { class: 'q-title' }, s.opts.title || MODE_TITLE[s.mode])),
      h('div', { class: 'q-body result' }, ...nodes));
  }
  function resultList() {
    return h('div', { class: 'res-list' }, h('h3', {}, '📝 ふりかえり'),
      s.results.map((r, i) => h('details', { class: 'res-item ' + (r.ok ? 'ok' : 'ng') },
        h('summary', {}, `${r.ok ? '⭕' : '❌'} ${i + 1}. ${r.q.q}`),
        h('div', { class: 'res-detail' },
          h('div', {}, `あなたの答え：${r.chosen}`),
          h('div', {}, `正解：${r.q.c[0]}`),
          h('div', { class: 'explain' }, '💡 ' + r.q.e)))));
  }

  function finish() {
    clearTimer();
    if (s.mode === 'kantei') finishKantei();
    else if (s.mode === 'exam') finishExam();
    else finishReview();
  }

  function finishKantei() {
    const S = AK.S, n = s.correct, total = s.total;
    const rank = n >= 18 ? 'S' : n >= 15 ? 'A' : n >= 12 ? 'B' : 'C';
    const isBest = n > S.best.kantei;
    if (isBest) S.best.kantei = n;
    if (rank === 'S') S.stats.kanteiS++;
    AK.track('kantei');
    const coins = n * 5, xp = n * 8;
    AK.addCoins(coins);
    const drops = AK.rollAndGive({ S: 3, A: 2, B: 1, C: 0 }[rank], 'mix', 10);

    const byField = {};
    s.results.forEach((r) => {
      byField[r.q.f] = byField[r.q.f] || { a: 0, c: 0 };
      byField[r.q.f].a++;
      if (r.ok) byField[r.q.f].c++;
    });
    const rewardBox = h('div', { class: 'reward' });
    resultScreen(
      h('div', { class: 'rank rank-' + rank }, rank),
      h('div', { class: 'score' }, `${n} / ${total} 問正解`),
      isBest ? h('div', { class: 'best' }, '🎉 自己ベスト更新！') : null,
      h('div', { class: 'field-break' }, Object.entries(byField).map(([f, v]) =>
        h('div', { class: 'fb-item', style: { '--fc': AK.FIELDS[f].color } }, `${AK.FIELDS[f].icon} ${AK.FIELDS[f].name}`, h('b', {}, ` ${v.c}/${v.a}`)))),
      rewardBox,
      h('div', { class: 'res-btns' },
        h('button', { class: 'btn', onclick: close }, 'とじる'),
        h('button', { class: 'btn primary', onclick: () => { const o = s.opts; close(); start(o); } }, 'もう一度')),
      resultList());
    AK.showDrops(rewardBox, drops, `+${xp} XP　+${coins} 💰`);
    AK.addXP(xp);
    if (rank === 'S') { AK.Sound.play('ssr'); AK.FX.confetti(160); }
    else if (rank === 'A') { AK.Sound.play('rare'); AK.FX.confetti(80); }
    AK.save();
  }

  function finishExam() {
    const need = s.opts.need || 4, pass = s.correct >= need, o = s.opts;
    resultScreen(
      h('div', { class: 'exam-result ' + (pass ? 'pass' : 'fail') }, pass ? '🎉 合格！' : '😢 不合格…'),
      h('div', { class: 'score' }, `${s.correct} / ${s.total} 問正解（合格ライン ${need}問）`),
      h('p', { class: 'center' }, pass ? '領土を広げる許可がおりました！' : '解説を読んで、もう一度チャレンジしよう！'),
      h('div', { class: 'res-btns' }, h('button', { class: 'btn primary big', onclick: () => { close(); if (o.onDone) o.onDone(pass); } }, pass ? '領土を広げる！' : 'もどる')),
      resultList());
    if (pass) { AK.Sound.play('levelup'); AK.FX.confetti(120); }
  }

  function finishBoss(win) {
    const S = AK.S, b = s.boss;
    if (!win) {
      resultScreen(
        h('div', { class: 'boss-big' }, b.emoji),
        h('div', { class: 'exam-result fail' }, '😵 撤退…'),
        h('p', { class: 'center' }, `${b.name}の残りHP：${b.hp} / ${b.max}`),
        h('p', { class: 'center' }, '解説を読んで作戦を立て直そう。何度でも挑戦できるぞ！'),
        h('div', { class: 'res-btns' },
          h('button', { class: 'btn', onclick: close }, 'とじる'),
          h('button', { class: 'btn primary', onclick: () => { const o = s.opts; close(); start(o); } }, '再挑戦！')),
        resultList());
      return;
    }
    S.boss.date = AK.today();
    S.boss.won = true;
    S.boss.wins++;
    AK.track('boss');
    const coins = 100 + 20 * Math.min(S.boss.wins, 10), xp = 60;
    AK.addCoins(coins);
    const drops = AK.rollAndGive(3, 'mix', 15);
    const rewardBox = h('div', { class: 'reward' });
    resultScreen(
      h('div', { class: 'boss-big down' }, b.emoji),
      h('div', { class: 'exam-result pass' }, '⚔️ 討伐成功！'),
      h('p', { class: 'center' }, `${s.correct}問正解・残りハート ${'❤️'.repeat(s.hearts)}`),
      h('div', { class: 'explain' }, `📖 ${b.name}：${b.desc}`),
      rewardBox,
      h('div', { class: 'res-btns' }, h('button', { class: 'btn primary big', onclick: close }, 'とじる')),
      resultList());
    AK.showDrops(rewardBox, drops, `+${xp} XP　+${coins} 💰`);
    AK.addXP(xp);
    AK.save();
  }

  function finishReview() {
    resultScreen(
      h('div', { class: 'exam-result pass' }, '📕 復習おつかれさま！'),
      h('div', { class: 'score' }, `${s.correct} / ${s.total} 問克服`),
      h('p', { class: 'center' }, `復習ノート：あと${AK.S.wrong.length}問（今すぐ復習できる問題 ${AK.reviewDue().length}問）`),
      h('div', { class: 'res-btns' }, h('button', { class: 'btn primary big', onclick: close }, 'とじる')),
      resultList());
  }

  AK.Quiz = { start, isOpen: () => !!s };
})(window.AK);
