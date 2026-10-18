/*
 * 先生用ダッシュボード：クラス作成・生徒の取り組み状況・分野別正答率・つまずき問題・CSV出力
 */
(function (AK) {
  'use strict';
  const { h } = AK;
  const main = document.getElementById('t-main');
  const userBox = document.getElementById('t-user');
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const FIELDS = Object.keys(AK.FIELDS);
  let auth, db, user, classes = [], current = null, students = [], sortKey = 'name', sortAsc = true;

  const pct = (c, a) => (a ? Math.round(c / a * 100) : null);
  const fmtPct = (p) => (p == null ? '—' : p + '%');
  const msg = (text) => { main.innerHTML = ''; main.append(h('div', { class: 't-panel center' }, text)); };

  function init() {
    if (!AK.FIREBASE_CONFIG || typeof firebase === 'undefined') {
      msg('Firebase が設定されていません。js/firebase-config.js を設定してください（docs/FIREBASE_SETUP.md 参照）。');
      return;
    }
    if (!firebase.apps.length) firebase.initializeApp(AK.FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    auth.onAuthStateChanged((u) => {
      user = u;
      userBox.innerHTML = '';
      if (!u) { showLogin(); return; }
      userBox.append(h('span', {}, u.email), h('a', { class: 't-btn', href: 'index.html' }, '🎮 ゲームへ'),
        h('button', { class: 't-btn', onclick: () => auth.signOut() }, 'ログアウト'));
      const isTeacher = AK.TEACHER_EMAILS.map((e) => e.toLowerCase()).includes((u.email || '').toLowerCase());
      if (!isTeacher) { msg('このアカウントは先生として登録されていません。js/firebase-config.js の TEACHER_EMAILS と firestore.rules に追加してください。'); return; }
      loadClasses();
    });
  }

  function showLogin() {
    main.innerHTML = '';
    main.append(h('div', { class: 't-panel center' },
      h('h2', {}, '👨‍🏫 先生用ログイン'),
      h('button', { class: 't-btn primary big', onclick: () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch((e) => alert(e.message)) }, 'Googleでログイン')));
  }

  async function loadClasses() {
    msg('読み込み中…');
    try {
      const qs = await db.collection('classes').where('teacherUid', '==', user.uid).get();
      classes = qs.docs.map((d) => Object.assign({ code: d.id }, d.data())).sort((a, b) => (a.name > b.name ? 1 : -1));
    } catch (e) { msg('読み込めませんでした：' + e.message); return; }
    if (!current && classes.length) current = classes[0].code;
    render();
    if (current) loadStudents();
  }

  async function createClass() {
    const name = prompt('クラス名を入力してください（例：1年A組 野菜）');
    if (!name) return;
    let code;
    for (let i = 0; i < 10; i++) {
      code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      if (!(await db.collection('classes').doc(code).get()).exists) break;
    }
    await db.collection('classes').doc(code).set({
      name: name.trim(), teacherUid: user.uid, teacherEmail: user.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    current = code;
    await loadClasses();
  }

  async function loadStudents() {
    const box = document.getElementById('t-class');
    if (box) box.innerHTML = '<div class="t-panel center">生徒データを読み込み中…</div>';
    try {
      const qs = await db.collection('users').where('classId', '==', current).get();
      students = qs.docs.map((d) => toRow(d.id, d.data()));
    } catch (e) {
      if (box) box.innerHTML = `<div class="t-panel center">読み込めませんでした：${e.message}</div>`;
      return;
    }
    renderClass();
  }

  function toRow(uid, d) {
    const st = d.stats || {};
    const bf = st.byField || {};
    const row = {
      uid, name: d.name || '', realName: d.realName || '', email: d.email || '',
      level: st.level || 1, answered: st.answered || 0, correct: st.correct || 0,
      acc: pct(st.correct || 0, st.answered || 0), kantei: st.kantei || 0, land: st.land || 3,
      week: st.weekKey === AK.weekKey() ? (st.weekCorrect || 0) : 0, dex: st.dex || 0, boss: st.bossWins || 0,
      lastPlay: st.lastPlay || '', wrong: st.wrong || [], qlog: st.qlog || {},
    };
    FIELDS.forEach((f) => {
      const v = bf[f] || {};
      row['f_' + f] = pct(v.c || 0, v.a || 0);
      row['fa_' + f] = v.a || 0;
      row['fc_' + f] = v.c || 0;
    });
    const fs = FIELDS.filter((f) => row['fa_' + f] >= 5).sort((a, b) => row['f_' + a] - row['f_' + b]);
    row.weak = fs.length ? AK.FIELDS[fs[0]].name : '—';
    return row;
  }

  function render() {
    main.innerHTML = '';
    const cls = classes.find((c) => c.code === current);
    main.append(h('div', { class: 't-panel' },
      h('div', { class: 't-row' },
        h('h2', {}, '🏫 クラス'),
        h('select', { class: 't-select', onchange: (e) => { current = e.target.value; render(); loadStudents(); } },
          classes.length ? classes.map((c) => h('option', { value: c.code, selected: c.code === current }, `${c.name}（${c.code}）`)) : h('option', {}, 'クラスがありません')),
        h('button', { class: 't-btn primary', onclick: createClass }, '＋ クラスを作成')),
      cls ? h('div', { class: 't-code' }, '生徒に伝えるクラスコード：', h('b', {}, cls.code),
        h('button', { class: 't-btn', onclick: () => navigator.clipboard.writeText(cls.code).then(() => alert('コピーしました')) }, 'コピー')) : null));
    main.append(h('div', { id: 't-class' }));
  }

  function renderClass() {
    const box = document.getElementById('t-class');
    box.innerHTML = '';
    const n = students.length;
    const sum = (k) => students.reduce((a, s) => a + (s[k] || 0), 0);
    const today = AK.today();
    const weekActive = students.filter((s) => s.week > 0).length;
    const todayActive = students.filter((s) => s.lastPlay === today).length;

    box.append(h('div', { class: 't-cards' },
      card('👥 生徒数', n + '人'),
      card('📅 今日プレイ', `${todayActive}人`),
      card('🗓️ 今週プレイ', `${weekActive}人`),
      card('📝 総解答数', sum('answered') + '問'),
      card('🎯 クラス正答率', fmtPct(pct(sum('correct'), sum('answered'))))));

    // 分野別正答率（クラス全体）
    const fieldTotals = FIELDS.map((f) => {
      let a = 0, c = 0;
      students.forEach((s) => { a += s['fa_' + f]; c += s['fc_' + f]; });
      return { f, a, p: pct(c, a) };
    });
    box.append(h('div', { class: 't-panel' }, h('h3', {}, '📊 分野別正答率（クラス全体）'),
      fieldTotals.map(({ f, a, p }) => h('div', { class: 't-fbar' },
        h('span', {}, `${AK.FIELDS[f].icon} ${AK.FIELDS[f].name}`),
        h('div', { class: 't-bar' }, h('i', { style: { width: (p || 0) + '%', background: AK.FIELDS[f].color } })),
        h('span', {}, `${fmtPct(p)}（${a}問）`)))));

    box.append(studentTable());
    box.append(weakQuestions());
  }
  const card = (label, val) => h('div', { class: 't-card' }, h('small', {}, label), h('b', {}, val));

  const COLS = [
    ['name', 'ニックネーム'], ['realName', '氏名'], ['level', 'Lv'], ['answered', '解答数'], ['acc', '正答率'],
    ...FIELDS.map((f) => ['f_' + f, AK.FIELDS[f].name]), ['weak', '苦手分野'], ['week', '今週正解'],
    ['kantei', '鑑定ベスト'], ['boss', 'ボス討伐'], ['lastPlay', '最終プレイ'],
  ];
  function studentTable() {
    const rows = students.slice().sort((a, b) => {
      const x = a[sortKey] == null ? -1 : a[sortKey], y = b[sortKey] == null ? -1 : b[sortKey];
      return (x > y ? 1 : x < y ? -1 : 0) * (sortAsc ? 1 : -1);
    });
    const fmt = (k, v) => (v == null ? '—' : k === 'acc' || k.startsWith('f_') ? v + '%' : v);
    const cls = (k, v) => (k === 'acc' || k.startsWith('f_')) && v != null ? (v < 50 ? 'low' : v >= 80 ? 'high' : '') : '';
    return h('div', { class: 't-panel' },
      h('div', { class: 't-row' }, h('h3', {}, '🧑‍🌾 生徒一覧'), h('span', { class: 'small' }, '見出しクリックで並べ替え'),
        h('button', { class: 't-btn', onclick: () => loadStudents() }, '🔄 更新'),
        h('button', { class: 't-btn', onclick: downloadCsv }, '⬇️ CSV出力')),
      h('div', { class: 't-table-wrap' }, h('table', { class: 't-table' },
        h('thead', {}, h('tr', {}, COLS.map(([k, label]) => h('th', {
          onclick: () => { if (sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = k === 'name' || k === 'realName'; } renderClass(); },
        }, label + (sortKey === k ? (sortAsc ? ' ▲' : ' ▼') : ''))))),
        h('tbody', {}, rows.length ? rows.map((r) => h('tr', {}, COLS.map(([k]) => h('td', { class: cls(k, r[k]) }, fmt(k, r[k])))))
          : h('tr', {}, h('td', { colspan: COLS.length, class: 'center' }, 'まだ生徒が参加していません。クラスコードを伝えましょう。'))))));
  }

  /** クラス全体で間違いが多い問題 */
  function weakQuestions() {
    const agg = {};
    students.forEach((s) => Object.entries(s.qlog).forEach(([id, [a, w]]) => {
      agg[id] = agg[id] || { a: 0, w: 0, people: 0 };
      agg[id].a += a; agg[id].w += w;
      if (w) agg[id].people++;
    }));
    const list = Object.entries(agg)
      .filter(([id, v]) => v.a >= 3 && v.w > 0 && AK.qById(id))
      .map(([id, v]) => ({ q: AK.qById(id), rate: v.w / v.a, ...v }))
      .sort((a, b) => b.rate - a.rate || b.w - a.w).slice(0, 15);
    return h('div', { class: 't-panel' },
      h('h3', {}, '⚠️ つまずきが多い問題 TOP15'),
      h('p', { class: 'small' }, '3回以上解答された問題のうち、不正解率が高い順。授業でのふりかえりにどうぞ。'),
      list.length ? h('table', { class: 't-table' },
        h('thead', {}, h('tr', {}, ['不正解率', '分野', '問題', '正解', '間違えた人数'].map((t) => h('th', {}, t)))),
        h('tbody', {}, list.map((x) => h('tr', {},
          h('td', { class: x.rate >= 0.5 ? 'low' : '' }, Math.round(x.rate * 100) + '%'),
          h('td', {}, AK.FIELDS[x.q.f].name),
          h('td', { class: 'q', title: x.q.e }, x.q.q),
          h('td', {}, x.q.c[0]),
          h('td', {}, x.people + '人')))))
        : h('p', { class: 'center small' }, 'まだデータが足りません'));
  }

  function downloadCsv() {
    const head = COLS.map(([, l]) => l).concat(['メール']);
    const lines = [head].concat(students.map((r) => COLS.map(([k]) => (r[k] == null ? '' : r[k])).concat([r.email])));
    const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `agri-kingdom_${current}_${AK.today()}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
  }

  // core.js の qById は quiz.js にあるので簡易版を用意
  if (!AK.qById) {
    const map = {};
    AK.QUESTIONS.forEach((q) => { map[q.id] = q; });
    AK.qById = (id) => map[id];
  }

  init();
})(window.AK);
