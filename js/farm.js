/*
 * 王国（畑）：配置・成長・収穫・病害虫トラブル・領土拡張
 */
(function (AK) {
  'use strict';
  const { h } = AK;
  const Farm = AK.Farm = { selected: null, tileEls: {}, sig: {} };
  const BUGS = [
    { e: '🐛', n: 'アオムシ' }, { e: '🐞', n: 'テントウムシダマシ' },
    { e: '🦗', n: 'バッタ' }, { e: '🐌', n: 'ナメクジ' }, { e: '🍄', n: 'カビ（病気）' },
  ];
  const MAX_LAND = 10;

  const it = (t) => AK.ITEMS[t.id];
  const isCrop = (t) => !!t && it(t) && it(t).type === 'crop';
  const keyOf = (x, y) => `${x},${y}`;
  const buildingsOf = (effect) => Object.entries(AK.S.tiles).filter(([, t]) => it(t) && it(t).effect === effect);
  /** マス k に効いている施設のうち、いちばん高い強化レベル（効いていなければ 0）。効果範囲は強化レベルで広がる */
  function nearLv(k, effect) {
    const [x, y] = k.split(',').map(Number);
    let best = 0;
    for (const [bk, t] of buildingsOf(effect)) {
      const [bx, by] = bk.split(',').map(Number);
      const d = Math.max(Math.abs(bx - x), Math.abs(by - y));
      if (d > 0 && d <= AK.upgRange(t.id)) best = Math.max(best, AK.upgLv(t.id));
    }
    return best;
  }
  const effMult = (k, effect) => { const lv = nearLv(k, effect); return lv ? AK.upgMult(lv) : 1; };
  const countEffect = (effect) => buildingsOf(effect).length;
  function needTime(t) {
    const i = it(t);
    if (t.r) return Math.round(i.grow * 0.6); // 果樹の2回目以降
    return i.perennial ? Math.round(i.grow * 1.5) : i.grow;
  }
  const isReady = (t) => isCrop(t) && t.bug == null && t.p >= needTime(t);
  const speedOf = (k) => effMult(k, 'speed') * (AK.S.tiles[k] && AK.inSeason(AK.S.tiles[k].id) ? 1.5 : 1);
  Farm.expandCost = (land) => 50 + 50 * (land - 3) ** 2;

  Farm.readyCount = () => Object.values(AK.S.tiles).filter((t) => isReady(t) || (isCrop(t) && t.bug != null)).length;

  /** 経過時間ぶん成長させる（オフライン中も育つ）。状態が変わったら true */
  Farm.update = function () {
    const S = AK.S, now = Date.now();
    const dt = (now - (S.lastTick || now)) / 1000;
    S.lastTick = now;
    if (dt <= 0) return false;
    const online = dt < 5; // オフライン中は病害虫が発生しない
    let changed = false;
    const guardLv = Math.max(0, ...buildingsOf('guard').map(([, b]) => AK.upgLv(b.id)));
    const bugRate = 1 - AK.guardCut(guardLv);
    for (const [k, t] of Object.entries(S.tiles)) {
      if (!isCrop(t) || t.bug != null) continue;
      const need = needTime(t);
      if (t.p >= need) continue;
      t.p = Math.min(need, t.p + dt * speedOf(k));
      if (t.p >= need) changed = true;
      else if (online) {
        const ratio = t.p / need;
        if (ratio > 0.15 && ratio < 0.9 && !nearLv(k, 'guard') && Math.random() < dt / 110 * bugRate) {
          t.bug = Math.floor(Math.random() * BUGS.length);
          changed = true;
          if (Farm.tileEls[k]) AK.Sound.play('bug');
        }
      }
    }
    return changed;
  };

  // ---------- 描画 ----------
  Farm.render = function (container) {
    const S = AK.S;
    const prevPal = container.querySelector('.palette');
    const palScroll = prevPal ? prevPal.scrollLeft : 0;
    container.innerHTML = '';
    Farm.tileEls = {};
    Farm.sig = {};
    const hasTractor = countEffect('harvestAll') > 0;

    const head = h('div', { class: 'farm-head' },
      h('div', { class: 'kingdom-name' }, `${AK.designOf('emblem').mark} ${S.name || 'あなた'}の王国`),
      h('div', { class: 'farm-meta' }, `領土 ${S.land}×${S.land}`));
    const actions = h('div', { class: 'farm-actions' },
      hasTractor ? h('button', { class: 'btn small gold', onclick: harvestAll }, '🚜 一括収穫') : null,
      h('button', { class: 'btn small gold', onclick: () => Farm.workshop() }, '🛠️ 王国づくり'),
      h('button', { class: 'btn small', onclick: expandDialog, disabled: S.land >= MAX_LAND }, S.land >= MAX_LAND ? '🗺️ 領土MAX' : '🗺️ 領土を広げる'),
      h('button', { class: 'btn small', onclick: AK.showHelp }, '❓ 遊び方'));

    const D = S.design;
    const grid = h('div', { class: 'grid ground-' + (D.ground || 'default'), style: { gridTemplateColumns: `repeat(${S.land}, 1fr)` } });
    for (let y = 0; y < S.land; y++) {
      for (let x = 0; x < S.land; x++) {
        const k = keyOf(x, y);
        const el = h('button', { class: 'tile', onclick: () => onTile(k) });
        Farm.tileEls[k] = el;
        grid.append(el);
      }
    }
    const top = AK.designOf('top'), bottom = AK.designOf('bottom');
    // 景色：絵文字を並べるもの（row）と、1枚のイラスト（art）がある
    const scenery = (d, cls) => {
      if (d.art) return h('div', { class: 'scenery-art ' + cls }, h('img', { src: d.art, alt: d.name }));
      if (!d.row) return null;
      return h('div', { class: 'scenery ' + cls }, Array.from(d.row.replace(/\uFE0F/g, '')).map((ch) => h('span', {}, ch)));
    };
    const field = h('div', { class: 'field-area' },
      scenery(top, 'top'),
      h('div', { class: 'field-wrap fence-' + (D.fence || 'default') }, grid),
      scenery(bottom, 'bottom'));
    const month = new Date().getMonth() + 1;
    const shun = Object.keys(AK.ITEMS).filter((id) => AK.inSeason(id)).map((id) => AK.ITEMS[id].name);
    const season = h('div', { class: 'season-bar' },
      h('b', {}, `🗓️ ${month}月の旬`), ` ${shun.join('・')}`,
      h('span', { class: 'small' }, '（成長1.5倍・コイン1.5倍）'));
    container.append(h('div', { class: 'farm-screen sky-' + (D.sky || 'default') }, head, actions, season, field, renderPalette()));
    container.querySelector('.palette').scrollLeft = palScroll;
    Farm.fit();
    Farm.tick();
  };

  function renderPalette() {
    const S = AK.S;
    const ids = Object.keys(S.inv).filter((id) => S.inv[id] > 0 && AK.ITEMS[id]);
    const typeOrder = { crop: 0, building: 1, deco: 2 }, fieldOrder = { veg: 0, flower: 1, fruit: 2, crop: 3 };
    ids.sort((a, b) => {
      const A = AK.ITEMS[a], B = AK.ITEMS[b];
      return typeOrder[A.type] - typeOrder[B.type] || (fieldOrder[A.field] || 0) - (fieldOrder[B.field] || 0) || (A.rarity > B.rarity ? 1 : -1);
    });
    if (Farm.selected && Farm.selected !== 'pickup' && !S.inv[Farm.selected]) Farm.selected = null;

    const sel = (id) => () => { Farm.selected = Farm.selected === id ? null : id; AK.Sound.play('tap'); AK.refresh(); };
    const bar = h('div', { class: 'palette' },
      h('button', { class: 'pal-item tool' + (Farm.selected === 'pickup' ? ' sel' : ''), onclick: sel('pickup') },
        h('div', { class: 'pe' }, '📦'), h('div', { class: 'pn' }, 'しまう')));
    ids.forEach((id) => {
      const i = AK.ITEMS[id];
      bar.append(h('button', { class: `pal-item r-${i.rarity}${i.gold ? ' gold' : ''}${Farm.selected === id ? ' sel' : ''}`, onclick: sel(id) },
        h('div', { class: 'pe' }, i.emoji), h('div', { class: 'pn' }, i.name), h('div', { class: 'pc' }, '×' + S.inv[id]),
        AK.inSeason(id) ? h('div', { class: 'shun' }, '旬') : null));
    });
    let hint;
    if (!ids.length) {
      hint = h('div', { class: 'pal-empty' }, 'アイテムがありません。',
        h('button', { class: 'btn small primary', onclick: () => AK.go('quiz') }, '📝 問題を解いてゲット！'));
    } else if (Farm.selected === 'pickup') hint = h('div', { class: 'pal-hint' }, '📦 しまいたいものをタップ（施設・かざりは倉庫にもどる）');
    else if (Farm.selected) hint = h('div', { class: 'pal-hint' }, `${AK.ITEMS[Farm.selected].emoji} 置きたいマスをタップ！`);
    else hint = h('div', { class: 'pal-hint' }, '👇 アイテムを選んで、空いているマスに置こう');
    return h('div', { class: 'palette-wrap' }, hint, bar);
  }

  /** マスの大きさに合わせて作物の絵の大きさを決める */
  Farm.fit = function () {
    const grid = document.querySelector('.farm-screen .grid');
    if (grid) grid.style.fontSize = Math.round(grid.clientWidth / AK.S.land * 0.58) + 'px';
  };
  addEventListener('resize', () => Farm.fit());

  /** 毎秒呼ばれる：変化したマスだけ描き直す */
  Farm.tick = function () {
    for (const k of Object.keys(Farm.tileEls)) renderTile(k);
  };

  function renderTile(k) {
    const el = Farm.tileEls[k], t = AK.S.tiles[k];
    if (!el) return;
    if (!t || !it(t)) {
      const sig = 'empty' + (Farm.selected && Farm.selected !== 'pickup' ? '+' : '');
      if (Farm.sig[k] !== sig) {
        Farm.sig[k] = sig;
        el.className = 'tile empty' + (sig.endsWith('+') ? ' can-place' : '');
        el.innerHTML = '';
      }
      return;
    }
    const i = it(t);
    if (i.type !== 'crop') {
      const lv = AK.isUpgradable(t.id) ? AK.upgLv(t.id) : 1; // 強化レベルで見た目も変わる
      const sig = 'obj' + t.id + i.emoji + lv;
      if (Farm.sig[k] !== sig) {
        Farm.sig[k] = sig;
        el.className = `tile obj r-${i.rarity}${i.gold ? ' gold' : ''}${lv > 1 ? ' up' + lv : ''}`;
        el.innerHTML = `<span class="em">${i.emoji}</span>`
          + (lv > 1 ? `<span class="upg-badge">${'★'.repeat(lv)}</span>` : '')
          + (lv >= 3 ? '<span class="upg-spark">✨</span>' : '');
      }
      return;
    }
    const need = needTime(t), ratio = Math.min(1, t.p / need);
    const stage = t.bug != null ? 'bug' + t.bug : ratio >= 1 ? 'ready' : ratio < 0.5 ? 's1' : 's2';
    const shun = AK.inSeason(t.id);
    const boost = stage !== 'ready' && nearLv(k, 'speed') > 0; // スプリンクラーが効いている
    const sig = t.id + stage + shun + boost;
    if (Farm.sig[k] !== sig) {
      Farm.sig[k] = sig;
      let inner;
      if (stage === 'ready') {
        inner = i.perennial
          ? `<span class="em tree">🌳</span><span class="fruit">${i.emoji}</span>`
          : `<span class="em">${i.emoji}</span>`;
        inner += '<span class="spark">✨</span>';
      } else {
        const sprout = stage === 's1' ? '🌱' : i.perennial ? '🌳' : '🌿';
        inner = `<span class="em ${stage}">${sprout}</span><span class="mini">${i.emoji}</span><div class="pbar"><i></i></div>`;
        if (t.bug != null) inner += `<span class="bug">${BUGS[t.bug].e}</span><span class="alert">!</span>`;
      }
      if (shun) inner += '<span class="shun">旬</span>';
      if (boost) inner += `<span class="boost">💦×${AK.upgMult(nearLv(k, 'speed'))}</span>`;
      el.className = `tile crop ${stage === 'ready' ? 'ready' : ''} ${t.bug != null ? 'has-bug' : ''} ${i.gold ? 'gold' : ''} ${boost ? 'boosted' : ''}`;
      el.innerHTML = inner;
    }
    const bar = el.querySelector('.pbar i');
    if (bar) bar.style.width = (ratio * 100).toFixed(1) + '%';
  }

  // ---------- 操作 ----------
  function onTile(k) {
    const S = AK.S, t = S.tiles[k], sel = Farm.selected, el = Farm.tileEls[k];
    if (sel === 'pickup') {
      if (!t) return;
      const i = it(t);
      if (i.type === 'crop') {
        AK.confirm(`${i.emoji} ${i.name}を抜きますか？<br><small>（植えた作物はなくなります）</small>`, () => {
          delete S.tiles[k]; AK.save(); AK.refresh();
        });
      } else {
        delete S.tiles[k];
        AK.giveBack(t.id);
        AK.Sound.play('place');
        AK.save(); AK.refresh();
      }
      return;
    }
    if (!t) {
      if (!sel) { AK.toast('下のアイテムを選んでから、空いているマスをタップしよう'); return; }
      if (!AK.useItem(sel)) { Farm.selected = null; AK.refresh(); return; }
      const i = AK.ITEMS[sel];
      S.tiles[k] = i.type === 'crop' ? { id: sel, p: 0 } : { id: sel };
      AK.Sound.play('place');
      const c = AK.centerOf(el);
      AK.FX.confetti(12, { x: c.x, y: c.y, spread: 5, colors: ['#8ac926', '#d9f99d', '#a16207'] });
      AK.track('place');
      if (!S.inv[sel]) Farm.selected = null;
      AK.save(); AK.refresh();
      return;
    }
    const i = it(t);
    if (i.type === 'crop') {
      if (t.bug != null) {
        // 連打対策：まちがえたら20秒間は再挑戦できない
        if (t.lock && t.lock > Date.now()) { AK.toast(`🐛 作戦を立て直し中… あと${Math.ceil((t.lock - Date.now()) / 1000)}秒で再挑戦できます`); return; }
        startTrouble(k);
        return;
      }
      if (isReady(t)) {
        harvest(k);
        AK.save(); AK.refresh();
        return;
      }
      AK.toast(`${i.emoji} ${i.name}：収穫まであと ${AK.fmtTime((needTime(t) - t.p) / speedOf(k))}${nearLv(k, 'speed') ? `<br><small>💦 スプリンクラー効果で ${AK.upgMult(nearLv(k, 'speed'))}倍速！</small>` : ''}`);
      return;
    }
    showObjInfo(k);
  }

  function harvest(k, silent) {
    const S = AK.S, t = S.tiles[k], i = it(t);
    const castles = buildingsOf('castle');
    const castle = castles.length ? 1.3 + 0.1 * (Math.max(...castles.map(([, c]) => AK.upgLv(c.id))) - 1) : 1;
    const shopBonus = buildingsOf('shop').slice(0, 3).reduce((a, [, b]) => a + 0.2 + 0.1 * (AK.upgLv(b.id) - 1), 0);
    let coin = i.coin * castle * (1 + shopBonus);
    let xp = i.xp * castle;
    coin *= effMult(k, 'coin');
    if (AK.inSeason(t.id)) coin *= 1.5;
    const home = Object.values(S.tiles).some((x) => x.id === 'house') ? AK.ITEMS.house.bonus || 0 : 0;
    coin *= 1 + home;
    xp *= 1 + home;
    xp *= effMult(k, 'xp');
    coin = Math.round(coin);
    xp = Math.round(xp);
    S.stats.harvested++;
    S.dex[t.id] = S.dex[t.id] || { got: 1, h: 0 };
    S.dex[t.id].h++;
    const seedBack = !i.perennial && Math.random() < 0.15;
    if (i.perennial) { t.p = 0; t.r = true; } else delete S.tiles[k];
    if (seedBack) AK.giveBack(t.id);
    AK.addCoins(coin);
    AK.addXP(xp);
    AK.track('harvest');
    const el = Farm.tileEls[k];
    if (el && !silent) {
      const c = AK.centerOf(el);
      AK.Sound.play('harvest');
      setTimeout(() => AK.Sound.play('coin'), 120);
      AK.FX.emoji(i.emoji, 6, c.x, c.y);
      AK.floatText(`+${coin}💰 +${xp}XP`, c.x, c.y - 10, 'coin');
      if (seedBack) setTimeout(() => AK.floatText('🌱 種が採れた！', c.x, c.y + 10, 'good'), 400);
    }
    return { coin, xp };
  }

  function harvestAll() {
    const keys = Object.keys(AK.S.tiles).filter((k) => isReady(AK.S.tiles[k]));
    if (!keys.length) { AK.toast('収穫できる作物がありません'); return; }
    let coin = 0, xp = 0;
    keys.forEach((k) => {
      const c = AK.centerOf(Farm.tileEls[k]);
      AK.FX.emoji(it(AK.S.tiles[k]).emoji, 3, c.x, c.y);
      const r = harvest(k, true);
      coin += r.coin; xp += r.xp;
    });
    AK.Sound.play('levelup');
    AK.bigText(`🚜 ${keys.length}個収穫！`, 'mega');
    AK.floatText(`+${coin}💰 +${xp}XP`, innerWidth / 2, innerHeight / 2 + 50, 'coin');
    AK.save(); AK.refresh();
  }

  function startTrouble(k) {
    const t = AK.S.tiles[k], i = it(t), bug = BUGS[t.bug];
    AK.Quiz.start({
      mode: 'trouble', field: i.field, title: `${bug.e} ${bug.n}が発生！`,
      intro: `${i.emoji}${i.name}に${bug.n}が発生！正解して作物を守ろう。守りきると一気に成長するぞ！`,
      onDone(ok) {
        const cur = AK.S.tiles[k];
        if (ok && cur === t) {
          t.bug = null;
          t.p = needTime(t);
          AK.S.stats.troubles++;
          AK.track('trouble');
          AK.addXP(10);
          AK.save();
          AK.refresh();
          setTimeout(() => {
            const el = Farm.tileEls[k];
            if (!el) return;
            const c = AK.centerOf(el);
            AK.Sound.play('rare');
            AK.FX.confetti(40, { x: c.x, y: c.y });
            AK.floatText('🛡️ 撃退！一気に成長！', c.x, c.y - 10, 'good');
          }, 100);
        } else {
          if (!ok && cur === t) { t.lock = Date.now() + 20000; AK.save(); }
          AK.refresh();
        }
      },
    });
  }

  function showObjInfo(k) {
    const t = AK.S.tiles[k], i = it(t);
    AK.modal({
      title: `${i.emoji} ${i.name}`,
      body: h('div', {},
        h('div', { class: 'rar-tag r-' + i.rarity }, `${i.rarity}｜${AK.RARITY[i.rarity].name}`),
        i.effectText ? h('div', { class: 'effect' }, '✨ 効果：' + i.effectText) : null,
        h('p', {}, i.desc),
        AK.isUpgradable(t.id) ? h('p', { class: 'small' }, '🔧 「王国づくり」の施設強化で、効果を強くできます') : null),
      buttons: [
        { label: '📦 しまう', onClick: () => { delete AK.S.tiles[k]; AK.giveBack(t.id); AK.save(); AK.refresh(); } },
        AK.isUpgradable(t.id) ? { label: '🔧 強化する', onClick: () => { Farm.workshop('upg'); } } : null,
        { label: 'とじる', cls: 'primary' },
      ].filter(Boolean),
    });
  }

  // ---------- 王国づくり（施設強化・デザイン） ----------
  let wsTab = 'upg';
  Farm.workshop = function (tab) {
    if (tab) wsTab = tab;
    document.querySelectorAll('.modal-back.workshop-back').forEach((m) => m.remove());
    const body = h('div', { class: 'workshop' });
    const close = AK.modal({ title: '🛠️ 王国づくり', body, cls: 'wide', buttons: [{ label: 'とじる', cls: 'primary', onClick: () => AK.refresh() }] });
    document.querySelector('#modal-root .modal-back:last-child').classList.add('workshop-back');
    const draw = () => {
      const S = AK.S;
      body.innerHTML = '';
      const tabs = [['upg', '🔧 施設強化'], ...AK.DESIGN_SLOTS.map((d) => [d.key, `${d.icon} ${d.name}`])];
      body.append(
        h('div', { class: 'ws-coins' }, '所持コイン 💰 ', h('b', {}, String(S.coins))),
        h('div', { class: 'tabs' }, tabs.map(([id, label]) => h('button', {
          class: 'tab' + (wsTab === id ? ' on' : ''), onclick: () => { wsTab = id; AK.Sound.play('tap'); draw(); },
        }, label))));
      if (wsTab === 'upg') {
        const ids = Object.keys(AK.ITEMS).filter((id) => AK.isUpgradable(id) && (S.inv[id] || Object.values(S.tiles).some((t) => t.id === id)));
        body.append(h('p', { class: 'small' }, '強化は施設の種類ごと。同じ施設すべてに効きます。Lv.3で効果範囲が5×5マスに広がる！'));
        if (!ids.length) body.append(h('p', { class: 'center small' }, '強化できる施設をまだ持っていません。問題に正解して施設を手に入れよう！'));
        ids.forEach((id) => {
          const it = AK.ITEMS[id], lv = AK.upgLv(id), cost = AK.upgCost(id);
          body.append(h('div', { class: 'upg-row' },
            h('div', { class: 'upg-emoji' }, it.emoji),
            h('div', { class: 'upg-main' },
              h('div', { class: 'upg-name' }, `${it.name}　`, h('span', { class: 'lv' }, `Lv.${lv}`)),
              h('div', { class: 'small' }, '今：' + AK.effectTextFor(id, lv)),
              cost != null ? h('div', { class: 'small next' }, `▶ Lv.${lv + 1}：` + AK.effectTextFor(id, lv + 1)) : h('div', { class: 'small next' }, '★ 最大レベル')),
            cost != null ? h('button', {
              class: 'btn small gold', disabled: S.coins < cost,
              onclick: () => {
                if (!AK.upgrade(id)) return;
                AK.Sound.play('levelup');
                AK.bigText(`${it.name} Lv.${AK.upgLv(id)}！`, 'mega');
                AK.FX.confetti(80);
                draw();
              },
            }, `💰${cost}`) : h('span', { class: 'claimed' }, 'MAX')));
        });
        return;
      }
      const slot = wsTab;
      const grid = h('div', { class: 'design-grid' });
      AK.DESIGNS[slot].forEach((d) => {
        const owned = AK.designOwned(slot, d.id), on = (S.design[slot] || '') === d.id;
        grid.append(h('button', {
          class: 'design-card' + (on ? ' on' : ''),
          onclick: () => {
            if (on) return;
            if (owned) { S.design[slot] = d.id; AK.save(); AK.Sound.play('place'); draw(); AK.refresh(); return; }
            if (S.coins < d.price) { AK.toast(`コインが足りません（あと${d.price - S.coins}）`); return; }
            if (AK.buyDesign(slot, d.id)) {
              AK.Sound.play('rare');
              AK.FX.confetti(60);
              AK.toast(`🎨「${d.name}」を手に入れた！`);
              draw();
              AK.refresh();
            }
          },
        },
        h('div', { class: `design-prev prev-${slot} ${slot}-${d.id || 'default'}` },
          d.art ? h('img', { class: 'prev-art', src: d.art, alt: '' }) : d.row ? Array.from(d.row.replace(/\uFE0F/g, '')).slice(0, 4).join('') : d.mark || ''),
        h('div', { class: 'design-name' }, d.name),
        h('div', { class: 'design-price' }, on ? '✅ 使用中' : owned ? '持っている' : `💰 ${d.price}`)));
      });
      body.append(h('p', { class: 'small' }, '買ったデザインはいつでも切りかえられます。'), grid);
    };
    draw();
    return close;
  };

  function expandDialog() {
    const S = AK.S;
    if (S.land >= MAX_LAND) return;
    const cost = Farm.expandCost(S.land), enough = S.coins >= cost;
    AK.modal({
      title: '🗺️ 領土を広げる',
      body: h('div', {},
        h('p', {}, `領土を ${S.land}×${S.land} → ${S.land + 1}×${S.land + 1} に広げます。`),
        h('ul', { class: 'cond' },
          h('li', { class: enough ? 'ok' : 'ng' }, `💰 ${cost} コイン（所持：${S.coins}）`),
          h('li', {}, '📜 昇格試験：5問中4問以上正解')),
        h('p', { class: 'small' }, 'コインは合格したときだけ支払います。'),
        !enough ? h('p', { class: 'warn' }, 'コインが足りません。作物を収穫して集めよう！') : null),
      buttons: [
        { label: 'やめる' },
        {
          label: '試験に挑戦！', cls: 'primary', disabled: !enough,
          onClick: () => AK.Quiz.start({
            mode: 'exam', count: 5, need: 4, title: `昇格試験（${S.land + 1}×${S.land + 1}）`,
            onDone(pass) {
              if (!pass) return;
              S.coins -= cost;
              S.land++;
              S.stats.exams++;
              AK.checkAchievements();
              AK.save();
              AK.go('farm');
              AK.bigText(`領土 ${S.land}×${S.land}！`, 'mega');
              AK.FX.confetti(150);
              AK.Sound.play('levelup');
            },
          }),
        },
      ],
    });
  }
})(window.AK);
