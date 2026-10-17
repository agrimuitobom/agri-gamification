/*
 * 起動・画面切り替え・トップバー・はじめての案内・レベルアップ演出
 */
(function (AK) {
  'use strict';
  const { h } = AK;
  const TABS = [
    { id: 'farm', icon: '🏰', label: '王国' },
    { id: 'quiz', icon: '📝', label: '鑑定' },
    { id: 'bag', icon: '🎒', label: '倉庫' },
    { id: 'dex', icon: '📖', label: '図鑑' },
    { id: 'rank', icon: '🥇', label: 'ランク', cloud: true },
    { id: 'rec', icon: '🏆', label: '記録' },
  ];
  const SCREENS = {
    farm: (v) => AK.Farm.render(v),
    quiz: (v) => AK.Screens.quiz(v),
    bag: (v) => AK.Screens.bag(v),
    dex: (v) => AK.Screens.dex(v),
    rank: (v) => AK.Screens.rank(v),
    rec: (v) => AK.Screens.rec(v),
  };
  let current = 'farm';
  const view = () => document.getElementById('view');

  AK.go = function (tab) {
    current = tab;
    renderTabs();
    SCREENS[current](view());
    view().scrollTop = 0;
  };
  AK.refresh = () => SCREENS[current](view());

  function renderTop() {
    const S = AK.S, need = AK.xpNeed(S.level);
    document.getElementById('topbar').innerHTML = '';
    document.getElementById('topbar').append(
      h('div', { class: 'tb-lv' }, h('small', {}, 'Lv'), String(S.level)),
      h('div', { class: 'tb-mid' },
        h('div', { class: 'tb-title' }, AK.title(S.level)),
        h('div', { class: 'xpbar' }, h('i', { style: { width: (S.xp / need * 100) + '%' } })),
        h('div', { class: 'tb-xp' }, `${S.xp} / ${need} XP`)),
      h('div', { class: 'tb-coin' }, '💰 ', h('b', {}, String(S.coins))),
      h('button', {
        class: 'tb-sound', 'aria-label': '効果音',
        onclick: () => { S.settings.sound = !S.settings.sound; AK.save(); renderTop(); },
      }, S.settings.sound ? '🔊' : '🔇'));
  }

  function renderTabs() {
    const nav = document.getElementById('tabbar');
    nav.innerHTML = '';
    const ready = AK.Farm.readyCount();
    const missions = AK.S.daily.missions.filter((m) => { const d = AK.missionDef(m.id); return d && !m.claimed && m.prog >= d.goal; }).length;
    const badge = { farm: ready, quiz: missions + (AK.bossToday().won ? 0 : 1) };
    TABS.filter((t) => !t.cloud || AK.Cloud.enabled).forEach((t) => nav.append(h('button', {
      class: 'tabbtn' + (current === t.id ? ' on' : ''),
      onclick: () => { AK.Sound.play('tap'); AK.go(t.id); },
    },
    h('span', { class: 'ti' }, t.icon),
    h('span', { class: 'tl' }, t.label),
    badge[t.id] ? h('span', { class: 'badge' }, String(badge[t.id])) : null)));
  }

  AK.showHelp = function () {
    const slides = [
      ['📝', '問題に答えてアイテムGET', '「鑑定」タブで、野菜・草花・果樹・作物の問題に挑戦！<br>正解すると<b>種・苗・施設</b>が手に入る。<br>コンボを続けるとレアが出やすく、<b>5コンボでFEVER（報酬2倍）</b>！'],
      ['🌱', '王国に植えて育てよう', '「王国」タブで、下のアイテムを選んでマスをタップ。<br>時間がたつと育って✨収穫できる！<br>果樹は何度でも収穫できるぞ。<br><b>🐛病害虫</b>が出たら、問題に正解して撃退しよう。'],
      ['🗺️', '王国を大きく・美しく', '収穫でコインとXPがたまる。<br>コインで<b>領土拡張</b>（昇格試験つき）・<b>施設強化</b>・<b>王国デザイン</b>（空・さく・景色など）ができる！<br>施設は周りのマスに効果があるので、配置を工夫しよう。'],
      ['⚔️', 'ボス・旬・競技', '毎日<b>ボス</b>が襲来！正解で攻撃、まちがえるとハートが減る。<br><b>🗓️旬</b>の作物は成長もコインも1.5倍。いまの季節に合う作物を植えよう！'],
      ...(AK.Cloud.enabled ? [['🥇', 'クラスで競おう', 'クラスコードを入力すると、<b>クラスランキング</b>に参加できる。<br>今週の正解数・鑑定競技ベスト・レベルなどで競争だ！<br>データはクラウドに保存されるので、どのPCからでも続きができるよ。']] : []),
      ['🏅', 'もっとやりこむ', '<b>鑑定競技モード</b>：本番形式の20問タイムアタック<br><b>復習ノート</b>：間違えた問題を、間隔をあけて3回正解すると卒業<br><b>デイリーミッション</b>・<b>図鑑</b>・<b>実績</b>もコンプリートを目指そう！'],
    ];
    let i = 0;
    const show = () => {
      const [icon, title, text] = slides[i];
      AK.modal({
        cls: 'help', dismissible: false,
        body: h('div', {},
          h('div', { class: 'help-icon' }, icon),
          h('h2', { class: 'modal-title' }, title),
          h('p', { html: text }),
          h('div', { class: 'dots' }, slides.map((_, j) => h('span', { class: j === i ? 'on' : '' })))),
        buttons: i < slides.length - 1
          ? [{ label: 'とじる' }, { label: '次へ ▶', cls: 'primary', onClick: () => { i++; setTimeout(show, 0); } }]
          : [{ label: 'はじめる！', cls: 'primary', onClick: () => { if (AK.Cloud.enabled && !AK.S.classId) setTimeout(() => AK.classDialog(() => AK.refresh()), 300); } }],
      });
    };
    show();
  };

  function firstRun() {
    const input = h('input', { class: 'text-input', placeholder: '例：のうか', maxlength: 12 });
    AK.modal({
      cls: 'welcome', dismissible: false,
      body: h('div', {},
        h('div', { class: 'help-icon' }, '🏰'),
        h('h2', { class: 'modal-title' }, 'アグリキングダムへようこそ！'),
        h('p', {}, '農業の知識で、自分だけの王国をつくろう。'),
        h('p', { class: 'small' }, 'あなたの名前（王国の名前になります）'),
        input),
      buttons: [{
        label: '王国をつくる！', cls: 'primary big',
        onClick: () => {
          AK.S.name = input.value.trim() || 'のうか';
          AK.save();
          renderTop();
          AK.refresh();
          setTimeout(AK.showHelp, 250);
          AK.Cloud.push(true);
        },
      }],
    });
    setTimeout(() => input.focus(), 100);
  }

  function loginBonus(d) {
    AK.Sound.play('coin');
    AK.modal({
      title: '🌅 ログインボーナス',
      body: h('div', { class: 'center' },
        h('div', { class: 'help-icon' }, '💰'),
        h('p', {}, `連続 ${d.streak}日目！`),
        h('p', { class: 'big-num' }, `+${d.bonus} コイン`),
        h('p', { class: 'small' }, '毎日ログインするとボーナスが増えるよ（最大7日）。今日のミッションもチェック！')),
      buttons: [{ label: '受け取る', cls: 'primary' }],
    });
  }

  function levelUp(lv) {
    const prevTitle = AK.title(lv - 1), newTitle = AK.title(lv);
    const prevHouse = AK.houseStage(lv - 1), newHouse = AK.houseStage(lv);
    const coins = lv * 10;
    AK.S.coins += coins;
    const drops = AK.rollAndGive(1, 'mix', 8);
    AK.save();
    renderTop();
    AK.Sound.play('levelup');
    AK.flash('gold');
    AK.FX.confetti(150, { y: innerHeight / 4 });
    const box = h('div', { class: 'reward' });
    AK.modal({
      cls: 'levelup',
      body: h('div', { class: 'center' },
        h('div', { class: 'lvup-text' }, 'LEVEL UP!'),
        h('div', { class: 'lvup-num' }, `Lv.${lv}`),
        prevTitle !== newTitle ? h('div', { class: 'new-title' }, `🎖️ 称号「${newTitle}」を獲得！`) : null,
        prevHouse !== newHouse ? h('div', { class: 'house-evo' },
          h('div', { class: 'he-row' }, h('span', { class: 'he-old' }, prevHouse.emoji), ' ▶ ', h('span', { class: 'he-new' }, newHouse.emoji)),
          h('div', {}, `🏠 家が「${newHouse.name}」に進化した！`),
          h('small', {}, `収穫コイン・XP +${Math.round(newHouse.bonus * 100)}%`)) : null,
        box),
      buttons: [{ label: 'やったー！', cls: 'primary big' }],
    });
    setTimeout(() => AK.showDrops(box, drops, `+${coins} 💰`), 300);
  }

  // ---------- PWA：インストールボタン ----------
  let installEvent = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });
  addEventListener('appinstalled', () => { installEvent = null; AK.toast('📲 インストールしました！デスクトップやスタートメニューから起動できます'); });
  AK.canInstall = () => !!installEvent;
  AK.install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    if (AK.refresh) AK.refresh();
  };
  AK.installButton = () => (installEvent ? h('button', { class: 'btn small install-btn', onclick: AK.install }, '📲 アプリとしてインストール') : null);

  function init() {
    AK.load();
    AK.FX.init();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* オフライン対応は任意 */ });
    }
    document.addEventListener('pointerdown', () => AK.Sound.ensure(), { once: true });
    AK.Cloud.start(() => {
      try { startGame(); } catch (e) { AK.reportError('起動', e); }
    });
  }

  function startGame() {
    AK.Farm.update();
    const daily = AK.ensureDaily();
    renderTop();
    AK.go('farm');

    AK.on('change', () => { renderTop(); renderTabs(); });
    AK.on('levelup', (lv) => setTimeout(() => levelUp(lv), 1300));
    AK.on('achievement', (a) => {
      setTimeout(() => {
        AK.toast(`🏆 実績解除！ <b>${a.icon} ${a.name}</b><br><small>${a.desc}　+30💰</small>`, 'gold');
        AK.Sound.play('rare');
      }, 600);
    });
    AK.on('mission', (m) => setTimeout(() => AK.toast(`📋 ミッション達成！「${m.text}」<br><small>鑑定タブで報酬を受け取ろう</small>`, 'mission'), 300));

    let n = 0;
    setInterval(() => {
      const changed = AK.Farm.update();
      if (current === 'farm' && !AK.Quiz.isOpen()) AK.Farm.tick();
      if (changed) renderTabs();
      if (++n % 5 === 0) AK.save();
    }, 1000);
    addEventListener('pagehide', AK.save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) AK.save(); });

    if (!AK.S.name) firstRun();
    else {
      if (daily.newDay) loginBonus(daily);
      if (AK.Cloud.enabled && !AK.S.classId) setTimeout(() => AK.classDialog(() => AK.refresh()), daily.newDay ? 600 : 300);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.AK);
