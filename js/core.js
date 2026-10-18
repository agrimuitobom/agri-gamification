/*
 * コア：DOMヘルパー・セーブデータ・成長（XP/コイン/アイテム）・ミッション・実績
 */
window.AK = window.AK || {};
(function (AK) {
  'use strict';

  // ---------- DOM ヘルパー ----------
  AK.h = function (tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      } else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  };

  AK.rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  AK.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  AK.today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  AK.fmtTime = (sec) => {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? `${m}分${s}秒` : `${s}秒`;
  };

  // ---------- イベント ----------
  const listeners = {};
  AK.on = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
  AK.emit = (ev, ...args) => (listeners[ev] || []).forEach((fn) => fn(...args));

  // ---------- セーブデータ ----------
  const KEY = 'agriKingdom.save.v1';
  const MAP_KEYS = ['inv', 'tiles', 'dex', 'ach', 'qlog', 'rv', 'upg'];

  AK.defaultState = () => ({
    v: 1,
    name: '',
    coins: 0,
    xp: 0,
    level: 1,
    inv: {},
    land: 4,
    tiles: { '1,1': { id: 'house' } },
    lastTick: Date.now(),
    stats: {
      answered: 0, correct: 0, bestCombo: 0, harvested: 0, exams: 0, troubles: 0, reviewed: 0, kanteiS: 0,
      byField: { basic: { a: 0, c: 0 }, veg: { a: 0, c: 0 }, flower: { a: 0, c: 0 }, fruit: { a: 0, c: 0 }, crop: { a: 0, c: 0 }, food: { a: 0, c: 0 } },
    },
    dex: {},
    wrong: [], // 復習ノートに入っている問題ID
    rv: {}, // 復習ノートの進み具合 { id: { st: 正解回数, due: 次に出題できる時刻 } }
    recent: [], // 最近の正誤（連打対策の報酬ダウン判定用）
    upg: {}, // 施設の強化レベル { itemId: 2 }
    design: { owned: [], sky: '', fence: '', ground: '', emblem: '', top: '', bottom: '' },
    ach: {},
    daily: { date: '', missions: [], streak: 0 },
    best: { kantei: 0 },
    boss: { date: '', won: false, wins: 0 },
    weekly: { key: '', correct: 0 },
    qlog: {}, // 問題ごとの [解答数, 不正解数]（先生用ダッシュボードで使う）
    uid: '', // クラウド利用時のユーザーID
    classId: '',
    className: '',
    savedAt: 0,
    settings: { sound: true },
  });

  function merge(def, src) {
    if (typeof def !== 'object' || def === null || Array.isArray(def)) return src === undefined ? def : src;
    const out = Object.assign({}, def);
    if (src && typeof src === 'object') for (const k of Object.keys(src)) out[k] = k in def ? merge(def[k], src[k]) : src[k];
    return out;
  }

  /** 保存データを現在のバージョンの形にそろえて読み込む */
  AK.setState = function (s) {
    const st = merge(AK.defaultState(), s);
    // マップ型のデータはデフォルトとマージせずそのまま使う（家を動かした場合など）
    if (s) MAP_KEYS.forEach((k) => { if (s[k]) st[k] = s[k]; });
    AK.S = st;
    AK.applyHouse();
    AK.applyUpgrades();
  };

  // ---------- 施設強化（Lv1〜3。種類ごとに強化され、同じ施設すべてに効く） ----------
  AK.UPG_MAX = 3;
  AK.UPG_COST = { N: [150, 400], R: [300, 800], SR: [600, 1500], SSR: [1200, 3000] };
  AK.isUpgradable = (id) => ['speed', 'coin', 'xp', 'guard', 'shop', 'castle'].includes((AK.ITEMS[id] || {}).effect);
  AK.upgLv = (id) => (AK.S && AK.S.upg[id]) || 1;
  AK.upgCost = (id) => { const lv = AK.upgLv(id); return lv >= AK.UPG_MAX ? null : AK.UPG_COST[AK.ITEMS[id].rarity][lv - 1]; };
  AK.upgRange = (id) => (AK.upgLv(id) >= 3 ? 2 : 1); // Lv3 で 5×5 マスに
  AK.guardCut = (lv) => (lv >= 3 ? 0.5 : lv >= 2 ? 0.3 : 0); // かかしLv2以上：範囲外の病害虫も減る
  AK.upgMult = (lv) => 1.5 + 0.25 * (lv - 1); // 1.5 → 1.75 → 2.0
  AK.effectTextFor = function (id, lv) {
    const it = AK.ITEMS[id], area = lv >= 3 ? '周囲24マス（5×5）' : '周囲8マス';
    switch (it.effect) {
      case 'speed': return `${area}の作物の成長が${AK.upgMult(lv)}倍速`;
      case 'coin': return `${area}の収穫コイン${AK.upgMult(lv)}倍`;
      case 'xp': return `${area}の収穫XP${AK.upgMult(lv)}倍`;
      case 'guard': return `${area}で病害虫が発生しなくなる` + (lv >= 2 ? `＋王国全体の病害虫の発生${AK.guardCut(lv) * 100}%減` : '');
      case 'shop': return `王国全体の収穫コイン+${20 + 10 * (lv - 1)}%（3つまで重複）`;
      case 'castle': return `王国全体の収穫コイン・XP +${30 + 10 * (lv - 1)}%`;
      default: return it.effectText || '';
    }
  };
  AK.applyUpgrades = function () {
    Object.keys(AK.ITEMS).filter(AK.isUpgradable).forEach((id) => {
      const lv = AK.upgLv(id);
      AK.ITEMS[id].effectText = AK.effectTextFor(id, lv) + (lv > 1 ? `（Lv.${lv}）` : '');
    });
  };
  AK.upgrade = function (id) {
    const cost = AK.upgCost(id);
    if (cost == null || AK.S.coins < cost) return false;
    AK.S.coins -= cost;
    AK.S.upg[id] = AK.upgLv(id) + 1;
    AK.applyUpgrades();
    AK.checkAchievements();
    AK.save();
    AK.emit('change');
    return true;
  };

  // ---------- 王国デザイン ----------
  AK.designOwned = (slot, id) => id === '' || AK.S.design.owned.includes(slot + ':' + id);
  AK.designOf = (slot) => (AK.DESIGNS[slot] || []).find((d) => d.id === (AK.S.design[slot] || '')) || AK.DESIGNS[slot][0];
  AK.buyDesign = function (slot, id) {
    const d = AK.DESIGNS[slot].find((x) => x.id === id);
    if (!d || AK.designOwned(slot, id) || AK.S.coins < d.price) return false;
    AK.S.coins -= d.price;
    AK.S.design.owned.push(slot + ':' + id);
    AK.S.design[slot] = id;
    AK.checkAchievements();
    AK.save();
    AK.emit('change');
    return true;
  };

  // ---------- 農家の家の進化 ----------
  AK.houseStage = (lv) => AK.HOUSE_STAGES.filter((st) => lv >= st.lv).pop();
  /** レベルに合わせて「農家の家」アイテムの見た目・名前を更新 */
  AK.applyHouse = function () {
    const st = AK.houseStage(AK.S ? AK.S.level : 1), h = AK.ITEMS.house;
    const next = AK.HOUSE_STAGES.find((x) => x.lv > st.lv);
    h.emoji = st.emoji;
    h.name = st.name;
    h.desc = st.desc + (next ? `（Lv.${next.lv}で「${next.name}」に進化）` : '（最終形態）');
    h.effectText = st.bonus ? `王国に置いておくと、収穫コイン・XP +${Math.round(st.bonus * 100)}%` : 'Lv.5で進化すると、収穫ボーナスがつく';
    h.bonus = st.bonus;
  };

  // ---------- 図鑑の★（入手★1・収穫10回★2・収穫30回★3。施設は入手1/3/5個） ----------
  AK.stars = function (id) {
    const d = AK.S.dex[id], it = AK.ITEMS[id];
    if (!d || !it) return 0;
    if (it.type === 'crop') return d.h >= 30 ? 3 : d.h >= 10 ? 2 : 1;
    return d.got >= 5 ? 3 : d.got >= 3 ? 2 : 1;
  };
  AK.load = function () {
    let s = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) { /* 壊れたデータは無視 */ }
    AK.setState(s);
  };
  AK.save = function () {
    AK.S.savedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(AK.S)); } catch (e) { /* 容量不足など */ }
  };
  AK.resetAll = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
    location.reload();
  };
  AK.exportSave = () => btoa(unescape(encodeURIComponent(JSON.stringify(AK.S))));
  AK.importSave = function (str) {
    const s = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    if (!s || typeof s !== 'object' || !s.stats) throw new Error('invalid');
    localStorage.setItem(KEY, JSON.stringify(s));
    location.reload();
  };

  // ---------- アイテム・コイン・XP ----------
  /** クイズなどで入手。図鑑に登録し、初入手なら true を返す */
  AK.addItem = function (id, n = 1) {
    const S = AK.S;
    S.inv[id] = (S.inv[id] || 0) + n;
    const isNew = !S.dex[id];
    S.dex[id] = S.dex[id] || { got: 0, h: 0 };
    S.dex[id].got += n;
    return isNew;
  };
  /** 畑から倉庫に戻す（入手数にはカウントしない） */
  AK.giveBack = (id) => { AK.S.inv[id] = (AK.S.inv[id] || 0) + 1; };
  AK.useItem = function (id) {
    const S = AK.S;
    if (!S.inv[id]) return false;
    S.inv[id]--;
    if (S.inv[id] <= 0) delete S.inv[id];
    return true;
  };

  AK.xpNeed = (lv) => 30 + lv * 20;
  AK.addXP = function (n) {
    const S = AK.S;
    S.xp += n;
    let up = false;
    while (S.xp >= AK.xpNeed(S.level)) {
      S.xp -= AK.xpNeed(S.level);
      S.level++;
      up = true;
    }
    if (up) { AK.applyHouse(); AK.emit('levelup', S.level); }
    AK.emit('change');
  };
  AK.addCoins = function (n) {
    AK.S.coins += n;
    AK.emit('change');
  };

  // ---------- 復習ノート（間隔をあけて3回正解で卒業） ----------
  AK.REVIEW_GOAL = 3;
  AK.REVIEW_WAIT = [0, 10 * 60 * 1000, 20 * 60 * 60 * 1000]; // 正解0回→すぐ、1回→10分後、2回→翌日（20時間後）
  AK.reviewAdd = function (id) {
    const S = AK.S;
    if (!S.wrong.includes(id)) S.wrong.push(id);
    S.rv[id] = { st: 0, due: 0 };
  };
  AK.reviewDue = () => AK.S.wrong.filter((id) => ((AK.S.rv[id] || {}).due || 0) <= Date.now());
  AK.reviewStage = (id) => (AK.S.rv[id] || {}).st || 0;
  /** 復習で正解したとき。卒業したら true */
  AK.reviewCorrect = function (id) {
    const S = AK.S, r = S.rv[id] || { st: 0, due: 0 };
    r.st++;
    if (r.st >= AK.REVIEW_GOAL) {
      S.wrong = S.wrong.filter((x) => x !== id);
      delete S.rv[id];
      S.stats.reviewed++;
      return true;
    }
    r.due = Date.now() + AK.REVIEW_WAIT[r.st];
    S.rv[id] = r;
    return false;
  };
  /** 次に復習できるようになるまでの時間（ミリ秒）。なければ null */
  AK.reviewNextIn = function () {
    const S = AK.S, now = Date.now();
    const dues = S.wrong.map((id) => (S.rv[id] || {}).due || 0).filter((d) => d > now);
    return dues.length ? Math.min(...dues) - now : null;
  };
  AK.fmtWait = (ms) => (ms >= 3600000 ? `${Math.ceil(ms / 3600000)}時間` : `${Math.max(1, Math.ceil(ms / 60000))}分`);

  // ---------- 連打対策：最近の正答率 ----------
  AK.pushRecent = function (ok) {
    const r = AK.S.recent;
    r.push(ok ? 1 : 0);
    while (r.length > 10) r.shift();
  };
  /** 最近10問の正答率が4割未満なら報酬ダウン（4択の当てずっぽうは25%） */
  AK.lowAccuracy = () => AK.S.recent.length >= 6 && AK.S.recent.reduce((a, b) => a + b, 0) / AK.S.recent.length < 0.4;

  // ---------- 旬 ----------
  AK.inSeason = (id) => {
    const i = AK.ITEMS[id];
    return !!(i && i.season && i.season.includes(new Date().getMonth() + 1));
  };
  AK.fmtMonths = (m) => m.join('・') + '月';

  // ---------- 日替わりボス ----------
  AK.bossToday = function () {
    const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    const def = AK.BOSSES[day % AK.BOSSES.length];
    const wins = AK.S.boss.wins;
    return Object.assign({}, def, { hp: 100 + 25 * Math.min(wins, 8), won: AK.S.boss.date === AK.today() && AK.S.boss.won });
  };

  AK.TITLES = [[1, '見習い農家'], [3, '新米農家'], [5, '一人前農家'], [8, 'ベテラン農家'], [12, '農業名人'], [16, '農業博士'], [20, '農業王'], [30, '伝説の農業王']];
  AK.title = (lv) => AK.TITLES.filter(([l]) => lv >= l).pop()[1];

  // ---------- ドロップ抽選 ----------
  const RAR_ORDER = ['SSR', 'SR', 'R', 'N'];
  AK.rollRarity = function (combo = 0) {
    const c = Math.min(combo, 15);
    const w = [['SSR', 1 + 0.4 * c], ['SR', 5 + c], ['R', 24 + 2 * c], ['N', 70]];
    let r = Math.random() * w.reduce((a, [, v]) => a + v, 0);
    for (const [k, v] of w) if ((r -= v) < 0) return k;
    return 'N';
  };
  /** 分野 field の正解で手に入るアイテムを1つ抽選（コンボが高いほどレアが出やすい） */
  AK.rollDrop = function (field, combo = 0) {
    const rar = AK.rollRarity(combo);
    // 作物アイテムがある分野から選ぶ（共通の問題なら、どこかの分野の種が出る）
    const cropFields = Object.keys(AK.FIELDS).filter((k) => Object.values(AK.ITEMS).some((it) => it.type === 'crop' && it.field === k));
    const f = cropFields.includes(field) ? field : AK.rand(cropFields);
    const seedFirst = Math.random() < 0.72;
    const ids = Object.keys(AK.ITEMS);
    const seeds = (r) => ids.filter((id) => AK.ITEMS[id].type === 'crop' && AK.ITEMS[id].field === f && AK.ITEMS[id].rarity === r);
    const facs = (r) => ids.filter((id) => AK.ITEMS[id].type !== 'crop' && !AK.ITEMS[id].noDrop && AK.ITEMS[id].rarity === r);
    for (let i = RAR_ORDER.indexOf(rar); i < RAR_ORDER.length; i++) {
      const r = RAR_ORDER[i];
      let pool = seedFirst ? seeds(r) : facs(r);
      if (!pool.length) pool = seedFirst ? facs(r) : seeds(r);
      if (pool.length) return AK.rand(pool);
    }
    return 'tomato';
  };

  // ---------- デイリーミッション ----------
  AK.MISSIONS = [
    { id: 'correct10', text: '問題に10問正解する', goal: 10, ev: 'correct' },
    { id: 'correct20', text: '問題に20問正解する', goal: 20, ev: 'correct' },
    { id: 'basic5', text: '共通の問題に5問正解', goal: 5, ev: 'correct_basic' },
    { id: 'veg5', text: '野菜の問題に5問正解', goal: 5, ev: 'correct_veg' },
    { id: 'flower5', text: '草花の問題に5問正解', goal: 5, ev: 'correct_flower' },
    { id: 'fruit5', text: '果樹の問題に5問正解', goal: 5, ev: 'correct_fruit' },
    { id: 'crop5', text: '作物の問題に5問正解', goal: 5, ev: 'correct_crop' },
    { id: 'food5', text: '食品製造の問題に5問正解', goal: 5, ev: 'correct_food' },
    { id: 'harvest5', text: '5回収穫する', goal: 5, ev: 'harvest' },
    { id: 'combo5', text: '5コンボを達成する', goal: 5, ev: 'combo', max: true },
    { id: 'kantei1', text: '鑑定競技モードを1回クリア', goal: 1, ev: 'kantei' },
    { id: 'review3', text: '復習ノートで3問正解する', goal: 3, ev: 'review' },
    { id: 'place5', text: 'アイテムを5個配置する', goal: 5, ev: 'place' },
    { id: 'trouble1', text: '病害虫トラブルを1回解決', goal: 1, ev: 'trouble' },
    { id: 'boss1', text: '今日のボスを討伐する', goal: 1, ev: 'boss' },
  ];
  AK.missionDef = (id) => AK.MISSIONS.find((m) => m.id === id);

  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  /** 日付が変わっていたらミッション更新＆ログインボーナス計算 */
  AK.ensureDaily = function () {
    const S = AK.S, d = S.daily, t = AK.today();
    if (d.date === t) return { newDay: false };
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    d.streak = d.date === yStr ? d.streak + 1 : 1;
    d.date = t;
    const rng = seeded(t);
    const pool = AK.MISSIONS.slice();
    d.missions = [];
    // 1つは必ず「正解数」系にする
    const first = rng() < 0.5 ? 'correct10' : 'correct20';
    d.missions.push({ id: first, prog: 0, claimed: false });
    const rest = pool.filter((m) => !m.id.startsWith('correct1') && !m.id.startsWith('correct2'));
    while (d.missions.length < 3) {
      const m = rest.splice(Math.floor(rng() * rest.length), 1)[0];
      d.missions.push({ id: m.id, prog: 0, claimed: false });
    }
    const bonus = 10 + 10 * Math.min(d.streak, 7);
    S.coins += bonus;
    AK.save();
    return { newDay: true, streak: d.streak, bonus };
  };

  /** ゲーム内の出来事を記録（ミッション進行・実績チェック） */
  /** 週の始まり（月曜）の日付。ランキングの「今週」に使う */
  AK.weekKey = () => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  AK.track = function (ev, val = 1) {
    const S = AK.S;
    if (ev === 'correct') {
      const wk = AK.weekKey();
      if (S.weekly.key !== wk) S.weekly = { key: wk, correct: 0 };
      S.weekly.correct += val;
    }
    for (const m of S.daily.missions) {
      const def = AK.missionDef(m.id);
      if (!def || def.ev !== ev || m.claimed) continue;
      const before = m.prog;
      m.prog = def.max ? Math.max(m.prog, val) : m.prog + val;
      if (before < def.goal && m.prog >= def.goal) AK.emit('mission', def);
    }
    AK.checkAchievements();
  };

  // ---------- 実績 ----------
  const fc = (f) => (s) => s.stats.byField[f].c;
  const dexCount = (s) => Object.keys(s.dex).filter((id) => AK.ITEMS[id]).length;
  const dexTotal = () => Object.values(AK.ITEMS).filter((it) => !it.noDrop).length;
  AK.ACHIEVEMENTS = [
    { id: 'first', icon: '🌱', name: 'はじめの一歩', desc: '初めて正解する', ok: (s) => s.stats.correct >= 1 },
    { id: 'c50', icon: '🥉', name: '見習い鑑定士', desc: '累計50問正解', ok: (s) => s.stats.correct >= 50 },
    { id: 'c200', icon: '🥈', name: '一人前鑑定士', desc: '累計200問正解', ok: (s) => s.stats.correct >= 200 },
    { id: 'c500', icon: '🥇', name: '鑑定名人', desc: '累計500問正解', ok: (s) => s.stats.correct >= 500 },
    { id: 'c1000', icon: '👑', name: '鑑定マスター', desc: '累計1000問正解', ok: (s) => s.stats.correct >= 1000 },
    { id: 'combo5', icon: '🔥', name: 'ノってきた！', desc: '5コンボ達成', ok: (s) => s.stats.bestCombo >= 5 },
    { id: 'combo10', icon: '☄️', name: '止まらない！', desc: '10コンボ達成', ok: (s) => s.stats.bestCombo >= 10 },
    { id: 'combo30', icon: '🌋', name: '伝説のコンボ', desc: '30コンボ達成', ok: (s) => s.stats.bestCombo >= 30 },
    { id: 'basic30', icon: '🌱', name: '農業基礎マスター', desc: '共通の問題に30問正解', ok: (s) => fc('basic')(s) >= 30 },
    { id: 'veg30', icon: '🥕', name: '野菜博士', desc: '野菜の問題に30問正解', ok: (s) => fc('veg')(s) >= 30 },
    { id: 'flower30', icon: '🌷', name: '草花博士', desc: '草花の問題に30問正解', ok: (s) => fc('flower')(s) >= 30 },
    { id: 'fruit30', icon: '🍎', name: '果樹博士', desc: '果樹の問題に30問正解', ok: (s) => fc('fruit')(s) >= 30 },
    { id: 'crop30', icon: '🌾', name: '作物博士', desc: '作物の問題に30問正解', ok: (s) => fc('crop')(s) >= 30 },
    { id: 'food30', icon: '🍞', name: '食品製造博士', desc: '食品製造の問題に30問正解', ok: (s) => fc('food')(s) >= 30 },
    { id: 'h10', icon: '🧺', name: '初めての収穫祭', desc: '10回収穫する', ok: (s) => s.stats.harvested >= 10 },
    { id: 'h100', icon: '🎑', name: '豊作の王', desc: '100回収穫する', ok: (s) => s.stats.harvested >= 100 },
    { id: 'land6', icon: '🗺️', name: '領土拡大', desc: '領土を6×6に広げる', ok: (s) => s.land >= 6 },
    { id: 'land10', icon: '🏰', name: '大王国', desc: '領土を10×10に広げる', ok: (s) => s.land >= 10 },
    { id: 'ssr', icon: '🌈', name: '伝説との出会い', desc: 'レジェンドアイテムを手に入れる', ok: (s) => Object.keys(s.dex).some((id) => AK.ITEMS[id] && AK.ITEMS[id].rarity === 'SSR') },
    { id: 'dex50', icon: '📗', name: 'コレクター', desc: '図鑑を50%うめる', ok: (s) => dexCount(s) >= dexTotal() / 2 },
    { id: 'dex100', icon: '📚', name: '完全図鑑', desc: '図鑑をすべてうめる', ok: (s) => dexCount(s) >= dexTotal() },
    { id: 'star100', icon: '🌟', name: '図鑑マイスター', desc: '図鑑の★を100個集める', ok: (s) => Object.keys(AK.ITEMS).filter((id) => !AK.ITEMS[id].noDrop).reduce((a, id) => a + AK.stars(id), 0) >= 100 },
    { id: 'starAll', icon: '👑', name: '★コンプリート', desc: '図鑑をすべて★3にする', ok: (s) => Object.keys(AK.ITEMS).filter((id) => !AK.ITEMS[id].noDrop).every((id) => AK.stars(id) >= 3) },
    { id: 'castle', icon: '🏰', name: '農業王の城', desc: '農家の家を城まで進化させる（Lv.20）', ok: (s) => s.level >= 20 },
    { id: 'upg3', icon: '🔧', name: '施設マスター', desc: '施設をLv.3まで強化する', ok: (s) => Object.values(s.upg || {}).some((lv) => lv >= 3) },
    { id: 'design5', icon: '🎨', name: '王国デザイナー', desc: '王国デザインを5つ買う', ok: (s) => (s.design.owned || []).length >= 5 },
    { id: 'kanteiS', icon: '🏅', name: '鑑定競技Sランク', desc: '鑑定競技モードでSランク', ok: (s) => s.stats.kanteiS >= 1 },
    { id: 'trouble10', icon: '🛡️', name: '病害虫ハンター', desc: '病害虫トラブルを10回解決', ok: (s) => s.stats.troubles >= 10 },
    { id: 'boss1', icon: '⚔️', name: 'ボス討伐', desc: 'ボスを初めて討伐する', ok: (s) => s.boss.wins >= 1 },
    { id: 'boss10', icon: '🗡️', name: '王国の守護神', desc: 'ボスを10回討伐する', ok: (s) => s.boss.wins >= 10 },
    { id: 'review10', icon: '💪', name: '苦手克服', desc: '復習ノートの問題を10問卒業させる', ok: (s) => s.stats.reviewed >= 10 },
  ];
  AK.checkAchievements = function () {
    const S = AK.S;
    for (const a of AK.ACHIEVEMENTS) {
      if (S.ach[a.id] || !a.ok(S)) continue;
      S.ach[a.id] = Date.now();
      S.coins += 30;
      AK.emit('achievement', a);
    }
  };
})(window.AK);
