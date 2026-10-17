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
  const MAP_KEYS = ['inv', 'tiles', 'dex', 'ach', 'qlog'];

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
      byField: { veg: { a: 0, c: 0 }, flower: { a: 0, c: 0 }, fruit: { a: 0, c: 0 }, crop: { a: 0, c: 0 } },
    },
    dex: {},
    wrong: [],
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
    if (up) AK.emit('levelup', S.level);
    AK.emit('change');
  };
  AK.addCoins = function (n) {
    AK.S.coins += n;
    AK.emit('change');
  };

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
    const f = field === 'mix' || !AK.FIELDS[field] ? AK.rand(Object.keys(AK.FIELDS)) : field;
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
    { id: 'veg5', text: '野菜の問題に5問正解', goal: 5, ev: 'correct_veg' },
    { id: 'flower5', text: '草花の問題に5問正解', goal: 5, ev: 'correct_flower' },
    { id: 'fruit5', text: '果樹の問題に5問正解', goal: 5, ev: 'correct_fruit' },
    { id: 'crop5', text: '作物の問題に5問正解', goal: 5, ev: 'correct_crop' },
    { id: 'harvest5', text: '5回収穫する', goal: 5, ev: 'harvest' },
    { id: 'combo5', text: '5コンボを達成する', goal: 5, ev: 'combo', max: true },
    { id: 'kantei1', text: '鑑定競技モードを1回クリア', goal: 1, ev: 'kantei' },
    { id: 'review3', text: '復習ノートの問題を3問克服', goal: 3, ev: 'review' },
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
    { id: 'veg30', icon: '🥕', name: '野菜博士', desc: '野菜の問題に30問正解', ok: (s) => fc('veg')(s) >= 30 },
    { id: 'flower30', icon: '🌷', name: '草花博士', desc: '草花の問題に30問正解', ok: (s) => fc('flower')(s) >= 30 },
    { id: 'fruit30', icon: '🍎', name: '果樹博士', desc: '果樹の問題に30問正解', ok: (s) => fc('fruit')(s) >= 30 },
    { id: 'crop30', icon: '🌾', name: '作物博士', desc: '作物の問題に30問正解', ok: (s) => fc('crop')(s) >= 30 },
    { id: 'h10', icon: '🧺', name: '初めての収穫祭', desc: '10回収穫する', ok: (s) => s.stats.harvested >= 10 },
    { id: 'h100', icon: '🎑', name: '豊作の王', desc: '100回収穫する', ok: (s) => s.stats.harvested >= 100 },
    { id: 'land6', icon: '🗺️', name: '領土拡大', desc: '領土を6×6に広げる', ok: (s) => s.land >= 6 },
    { id: 'land10', icon: '🏰', name: '大王国', desc: '領土を10×10に広げる', ok: (s) => s.land >= 10 },
    { id: 'ssr', icon: '🌈', name: '伝説との出会い', desc: 'レジェンドアイテムを手に入れる', ok: (s) => Object.keys(s.dex).some((id) => AK.ITEMS[id] && AK.ITEMS[id].rarity === 'SSR') },
    { id: 'dex50', icon: '📗', name: 'コレクター', desc: '図鑑を50%うめる', ok: (s) => dexCount(s) >= dexTotal() / 2 },
    { id: 'dex100', icon: '📚', name: '完全図鑑', desc: '図鑑をすべてうめる', ok: (s) => dexCount(s) >= dexTotal() },
    { id: 'kanteiS', icon: '🏅', name: '鑑定競技Sランク', desc: '鑑定競技モードでSランク', ok: (s) => s.stats.kanteiS >= 1 },
    { id: 'trouble10', icon: '🛡️', name: '病害虫ハンター', desc: '病害虫トラブルを10回解決', ok: (s) => s.stats.troubles >= 10 },
    { id: 'boss1', icon: '⚔️', name: 'ボス討伐', desc: 'ボスを初めて討伐する', ok: (s) => s.boss.wins >= 1 },
    { id: 'boss10', icon: '🗡️', name: '王国の守護神', desc: 'ボスを10回討伐する', ok: (s) => s.boss.wins >= 10 },
    { id: 'review10', icon: '💪', name: '苦手克服', desc: '復習ノートの問題を10問克服', ok: (s) => s.stats.reviewed >= 10 },
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
