/*
 * ホーム画面への追加（PWA）の案内
 * - iPhone / iPad の Safari には「インストール」ボタンが出ないので、手順を図つきで案内する
 * - Android / PC の Chrome・Edge はブラウザのインストール機能（AK.install）を使う
 * - 初回だけ自動で表示（「あとで」なら3日後にもう一度）。記録タブからいつでも開ける
 */
(function (AK) {
  'use strict';
  const { h } = AK;
  const KEY = 'agriKingdom.installPrompt';
  const ua = navigator.userAgent;
  const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIOS = /iPhone|iPod/.test(ua) || isIPad;
  const isAndroid = /Android/.test(ua);
  const inAppBrowser = /Line\/|FBAN|FBAV|Instagram|Twitter|MicroMessenger/i.test(ua);
  const isIOSChrome = /CriOS/.test(ua);

  const Install = AK.Install = {
    isIOS, isAndroid,
    standalone: () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  };

  function getPref() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function setPref(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* noop */ }
  }
  const shouldAsk = () => {
    const p = getPref();
    return !Install.standalone() && !p.never && (!p.snoozeUntil || p.snoozeUntil < Date.now());
  };

  // iOS の「共有」アイコン（□に↑）
  const shareIcon = () => h('span', {
    class: 'ios-share',
    html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
  });
  const plusIcon = () => h('span', { class: 'ios-plus' }, '＋');
  const step = (n, ...body) => h('li', { class: 'inst-step' }, h('span', { class: 'inst-num' }, String(n)), h('div', {}, ...body));

  function iosSteps() {
    if (inAppBrowser) {
      const url = location.href.split('#')[0];
      return [
        h('p', { class: 'warn' }, 'LINEなどのアプリの中のブラウザでは、ホーム画面に追加できません。'),
        h('ol', { class: 'inst-steps' },
          step(1, '画面の右上（または右下）のメニューから「', h('b', {}, 'Safariで開く'), '」（「ブラウザで開く」）を選ぶ'),
          step(2, 'Safariで開いたら、もう一度この案内が出ます')),
        h('button', { class: 'btn small', onclick: () => navigator.clipboard && navigator.clipboard.writeText(url).then(() => AK.toast('URLをコピーしました。Safariに貼り付けて開いてね')) }, '📋 URLをコピー'),
      ];
    }
    if (isIOSChrome) {
      return [h('ol', { class: 'inst-steps' },
        step(1, 'アドレスバーの右の ', shareIcon(), '（共有）をタップ'),
        step(2, '「', h('b', {}, 'ホーム画面に追加'), '」をタップ'),
        step(3, '右上の「', h('b', {}, '追加'), '」をタップ'))];
    }
    return [h('ol', { class: 'inst-steps' },
      step(1, isIPad ? '画面右上の ' : '画面の下にある ', shareIcon(), '（', h('b', {}, '共有'), '）をタップ',
        h('small', {}, '見つからないときは「•••」をタップ →「共有」')),
      step(2, 'メニューを下にスクロールして ', plusIcon(), '「', h('b', {}, 'ホーム画面に追加'), '」をタップ',
        h('small', {}, '「Webアプリとして開く」が表示されたら、オンのままにしてね')),
      step(3, '右上の「', h('b', {}, '追加'), '」をタップ'),
      step(4, 'ホーム画面にできた ', h('img', { class: 'inst-mini', src: 'apple-touch-icon.png', alt: '' }), '「アグリ王国」から開いて遊ぼう！'))];
  }

  /** 案内を表示する。force: 記録タブなどから手動で開いたとき */
  Install.show = function (force) {
    if (!force && Install.shown) return;
    Install.shown = true;
    if (Install.standalone()) {
      if (force) AK.toast('すでにアプリとして開いています 👍');
      return;
    }
    // Android / PC：ブラウザのインストール機能が使えるならそれを使う
    if (!isIOS && AK.canInstall && AK.canInstall()) {
      AK.modal({
        title: '📲 アプリとしてインストール',
        body: h('div', { class: 'center' },
          h('img', { class: 'inst-icon', src: 'icon-192.png', alt: '' }),
          h('p', {}, 'ホーム画面（デスクトップ）から、アプリのように全画面ですぐ遊べます！')),
        buttons: [
          { label: 'あとで', onClick: () => setPref({ snoozeUntil: Date.now() + 3 * 86400000 }) },
          { label: 'インストール', cls: 'primary', onClick: () => { setPref({ never: true }); AK.install(); } },
        ],
      });
      return;
    }
    if (!isIOS) {
      if (force) AK.toast('ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでね');
      return;
    }
    const hint = !isIPad && !isIOSChrome && !inAppBrowser ? h('div', { class: 'inst-arrow' }, '👇') : null;
    if (hint) document.body.append(hint);
    AK.modal({
      cls: 'install',
      dismissible: false,
      body: h('div', {},
        h('div', { class: 'inst-head' },
          h('img', { class: 'inst-icon', src: 'apple-touch-icon.png', alt: '' }),
          h('div', {}, h('h2', { class: 'modal-title' }, 'ホーム画面に追加しよう！'),
            h('p', { class: 'small' }, 'アプリのように全画面で遊べて、アイコンからすぐ起動できます'))),
        ...iosSteps(),
        AK.Cloud && AK.FIREBASE_CONFIG ? h('p', { class: 'inst-note' },
          '💡 ホーム画面のアイコンから開いたら、もう一度Googleでログインしてね。データはクラウドに保存されるので、続きから遊べます。') : null),
      buttons: [
        { label: 'あとで', onClick: () => { setPref({ snoozeUntil: Date.now() + 3 * 86400000 }); if (hint) hint.remove(); } },
        { label: 'わかった！', cls: 'primary', onClick: () => { setPref({ never: true }); if (hint) hint.remove(); } },
      ],
    });
  };

  /** 起動時に呼ぶ：スマホ・タブレットで、まだアプリとして開いていなければ案内する */
  Install.maybeShow = function () {
    if (!shouldAsk()) return;
    if (isIOS) { setTimeout(() => Install.show(), 600); return; }
    if (isAndroid) {
      // Android は beforeinstallprompt が来てから案内する
      const tryShow = () => { if (shouldAsk() && AK.canInstall && AK.canInstall()) Install.show(); };
      setTimeout(tryShow, 1500);
      addEventListener('beforeinstallprompt', () => setTimeout(tryShow, 300));
    }
  };
})(window.AK);
