/*
 * クラウド（Firebase）：Googleログイン・クラウドセーブ・クラス参加・ランキング
 * FIREBASE_CONFIG が未設定、または Firebase が読み込めない（オフライン等）ときはローカル保存のみで動く。
 */
(function (AK) {
  'use strict';
  const { h } = AK;
  const PUSH_INTERVAL = 90 * 1000;
  const Cloud = AK.Cloud = { enabled: false, user: null, db: null, auth: null, lastSave: '', lastRank: '' };

  Cloud.configured = () => !!AK.FIREBASE_CONFIG && typeof window.firebase !== 'undefined';
  Cloud.isTeacher = () => !!(Cloud.user && AK.TEACHER_EMAILS.map((e) => e.toLowerCase()).includes((Cloud.user.email || '').toLowerCase()));
  Cloud.initApp = function () {
    if (!firebase.apps.length) firebase.initializeApp(AK.FIREBASE_CONFIG);
    Cloud.auth = firebase.auth();
    Cloud.db = firebase.firestore();
  };

  /** 起動時に呼ぶ。ログイン・同期が終わったら onReady() */
  Cloud.start = function (onReady) {
    if (!Cloud.configured()) { onReady(); return; }
    Cloud.initApp();
    Cloud.enabled = true;
    let first = true;
    const ready = () => { Cloud.started = true; onReady(); };
    Cloud.auth.onAuthStateChanged(async (user) => {
      if (!first) { if (!user && Cloud.started) location.reload(); return; }
      first = false;
      if (user) {
        if (await afterLogin(user)) ready();
        else showLogin(ready);
      } else showLogin(ready);
    });
  };

  function showLogin(onReady, error) {
    const root = document.getElementById('login-root');
    root.innerHTML = '';
    root.className = 'open';
    const btn = h('button', {
      class: 'google-btn',
      onclick: async () => {
        btn.disabled = true;
        msg.textContent = 'ログイン中…';
        try {
          const provider = new firebase.auth.GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account', ...(AK.ALLOWED_DOMAIN ? { hd: AK.ALLOWED_DOMAIN } : {}) });
          const res = await Cloud.auth.signInWithPopup(provider);
          if (await afterLogin(res.user)) { root.className = ''; onReady(); }
          else showLogin(onReady, msg.textContent);
        } catch (e) {
          btn.disabled = false;
          msg.textContent = e.code === 'auth/popup-closed-by-user' ? '' : 'ログインできませんでした（' + (e.code || e.message) + '）';
        }
      },
    }, h('span', { class: 'g' }, 'G'), 'Googleでログイン');
    const msg = h('div', { class: 'login-msg' }, error || '');
    root.append(h('div', { class: 'login-box' },
      h('div', { class: 'login-logo' }, '🏰'),
      h('h1', {}, 'アグリキングダム'),
      h('p', {}, '農業の知識で、自分だけの王国をつくろう'),
      btn, msg,
      h('p', { class: 'small' }, AK.ALLOWED_DOMAIN ? `学校のアカウント（@${AK.ALLOWED_DOMAIN}）でログインしてください` : '学校のGoogleアカウントでログインしてください'),
      AK.installButton ? AK.installButton() : null));
  }

  async function afterLogin(user) {
    const email = (user.email || '').toLowerCase();
    const okDomain = !AK.ALLOWED_DOMAIN || email.endsWith('@' + AK.ALLOWED_DOMAIN.toLowerCase());
    Cloud.user = user;
    if (!okDomain && !Cloud.isTeacher()) {
      await Cloud.auth.signOut().catch(() => {});
      Cloud.user = null;
      const m = document.querySelector('.login-msg');
      if (m) m.textContent = `@${AK.ALLOWED_DOMAIN} のアカウントでログインしてください`;
      return false;
    }
    document.getElementById('login-root').className = '';
    await sync(user);
    setInterval(() => Cloud.push(), PUSH_INTERVAL);
    document.addEventListener('visibilitychange', () => { if (document.hidden) Cloud.push(); });
    addEventListener('pagehide', () => Cloud.push());
    return true;
  }

  /** クラウドとローカルのうち新しいほうを使う */
  async function sync(user) {
    const local = AK.S;
    try {
      const snap = await withTimeout(Cloud.db.collection('users').doc(user.uid).get(), 8000);
      const remote = snap.exists && snap.data().save ? JSON.parse(snap.data().save) : null;
      if (remote && (local.uid !== user.uid || (remote.savedAt || 0) >= (local.savedAt || 0))) {
        AK.setState(remote);
      } else if (!remote && local.uid && local.uid !== user.uid) {
        AK.setState(null); // 別の人のデータが端末に残っていた → 新しく始める
      }
      AK.S.uid = user.uid;
      AK.save();
      await Cloud.push(true);
    } catch (e) {
      // オフラインなど：この端末のデータで続ける（次回つながったときに保存）
      if (local.uid && local.uid !== user.uid) AK.setState(null);
      AK.S.uid = user.uid;
      AK.save();
      setTimeout(() => AK.toast('📴 オフラインのため、この端末のデータで遊びます'), 1500);
    }
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  function summary() {
    const S = AK.S;
    return {
      level: S.level, answered: S.stats.answered, correct: S.stats.correct, byField: S.stats.byField,
      bestCombo: S.stats.bestCombo, kantei: S.best.kantei, land: S.land, harvested: S.stats.harvested,
      dex: Object.keys(S.dex).length, bossWins: S.boss.wins, weekKey: S.weekly.key, weekCorrect: S.weekly.correct,
      wrong: S.wrong.slice(0, 300), qlog: S.qlog, streak: S.daily.streak, lastPlay: AK.today(),
    };
  }
  function rankData() {
    const S = AK.S;
    return {
      name: S.name || 'ななしの農家', classId: S.classId, title: AK.title(S.level), level: S.level,
      correct: S.stats.correct, kantei: S.best.kantei, land: S.land, dex: Object.keys(S.dex).length,
      bossWins: S.boss.wins, weekKey: S.weekly.key, weekCorrect: S.weekly.correct,
    };
  }

  /** クラウドに保存（変化があったときだけ書き込む） */
  Cloud.push = async function (force) {
    if (!Cloud.user || !Cloud.db) return;
    const S = AK.S, uid = Cloud.user.uid;
    const save = JSON.stringify(S);
    const rank = S.classId ? JSON.stringify(rankData()) : '';
    if (!force && save === Cloud.lastSave) return;
    const ts = firebase.firestore.FieldValue.serverTimestamp();
    const batch = Cloud.db.batch();
    batch.set(Cloud.db.collection('users').doc(uid), {
      save, stats: summary(), name: S.name, classId: S.classId,
      email: Cloud.user.email || '', realName: Cloud.user.displayName || '', updatedAt: ts,
    }, { merge: true });
    if (rank && (force || rank !== Cloud.lastRank)) batch.set(Cloud.db.collection('ranks').doc(uid), Object.assign(rankData(), { updatedAt: ts }));
    try {
      await batch.commit();
      Cloud.lastSave = save;
      if (rank) Cloud.lastRank = rank;
    } catch (e) { /* オフライン：次回に再送 */ }
  };

  Cloud.joinClass = async function (code) {
    code = code.trim().toUpperCase();
    if (!code) return false;
    const snap = await Cloud.db.collection('classes').doc(code).get();
    if (!snap.exists) return false;
    AK.S.classId = code;
    AK.S.className = snap.data().name || code;
    AK.save();
    await Cloud.push(true);
    return true;
  };

  Cloud.fetchRanking = async function () {
    await Cloud.push(true);
    const qs = await Cloud.db.collection('ranks').where('classId', '==', AK.S.classId).limit(300).get();
    return qs.docs.map((d) => Object.assign({ uid: d.id }, d.data()));
  };

  Cloud.signOut = async function () {
    await Cloud.push(true);
    await Cloud.auth.signOut();
  };

  /** クラスコード入力ダイアログ */
  AK.classDialog = function (onDone) {
    const input = h('input', { class: 'text-input code-input', placeholder: '例：ABC123', maxlength: 8 });
    const msg = h('div', { class: 'warn small' });
    AK.modal({
      title: '🏫 クラスに参加',
      body: h('div', {}, h('p', { class: 'small' }, '先生から配られたクラスコードを入力してください。クラスのランキングに参加できます。'), input, msg),
      buttons: [{ label: 'あとで' }, {
        label: '参加する', cls: 'primary',
        onClick: () => {
          msg.textContent = '確認中…';
          Cloud.joinClass(input.value).then((ok) => {
            if (!ok) { msg.textContent = 'クラスコードが見つかりません'; return; }
            document.querySelectorAll('.modal-back').forEach((m) => m.remove());
            AK.toast(`🏫「${AK.S.className}」に参加しました！`);
            AK.Sound.play('rare');
            if (onDone) onDone();
          }, () => { msg.textContent = '通信できませんでした'; });
          return false;
        },
      }],
    });
    setTimeout(() => input.focus(), 100);
  };
})(window.AK);
