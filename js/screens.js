/*
 * 各画面：鑑定（問題メニュー）/ 倉庫 / 図鑑 / 記録
 */
(function (AK) {
  'use strict';
  const { h } = AK;
  const Screens = AK.Screens = {};
  const FIELD_ORDER = { veg: 0, flower: 1, fruit: 2, crop: 3 };
  const RAR_ORDER = { N: 0, R: 1, SR: 2, SSR: 3 };
  const byFieldRarity = (a, b) => {
    const A = AK.ITEMS[a], B = AK.ITEMS[b];
    return (FIELD_ORDER[A.field] ?? 9) - (FIELD_ORDER[B.field] ?? 9) || RAR_ORDER[A.rarity] - RAR_ORDER[B.rarity];
  };

  /** アイテム詳細モーダル */
  AK.itemModal = function (id, opts = {}) {
    const i = AK.ITEMS[id], S = AK.S, d = S.dex[id];
    const info = [];
    if (i.type === 'crop') {
      info.push(`⏱ 成長時間：${AK.fmtTime(i.perennial ? i.grow * 1.5 : i.grow)}${i.perennial ? `（2回目以降 ${AK.fmtTime(i.grow * 0.6)}）` : ''}`);
      info.push(`💰 収穫：${i.coin}コイン ／ ${i.xp}XP`);
      if (i.perennial) info.push('🌳 果樹は収穫しても木が残り、何度も収穫できる！');
      if (i.season) info.push(`🗓️ 旬：${AK.fmtMonths(i.season)}${AK.inSeason(id) ? '（いまが旬！成長1.5倍・コイン1.5倍）' : ''}`);
    }
    const buttons = [{ label: 'とじる' }];
    if (opts.place && S.inv[id]) {
      buttons.push({ label: '🏰 王国に置く', cls: 'primary', onClick: () => { AK.Farm.selected = id; AK.go('farm'); } });
    }
    AK.modal({
      cls: 'item-modal',
      body: h('div', {},
        h('div', { class: `big-emoji r-${i.rarity}${i.gold ? ' gold' : ''}` }, i.emoji),
        h('h2', { class: 'modal-title' }, i.name),
        h('div', { class: 'rar-tag r-' + i.rarity }, `${i.rarity}｜${AK.RARITY[i.rarity].name}${i.field ? '｜' + AK.FIELDS[i.field].name : ''}`),
        i.effectText ? h('div', { class: 'effect' }, '✨ 効果：' + i.effectText) : null,
        h('p', { class: 'desc' }, i.desc),
        info.map((t) => h('div', { class: 'info' }, t)),
        d ? h('div', { class: 'info dim' }, `入手 ${d.got}回${i.type === 'crop' ? `／収穫 ${d.h}回` : ''}　所持 ${S.inv[id] || 0}`) : null),
      buttons,
    });
  };

  // ---------- 鑑定（問題メニュー） ----------
  Screens.quiz = function (v) {
    const S = AK.S;
    v.innerHTML = '';

    const ms = h('div', { class: 'panel' }, h('h3', {}, '📋 今日のミッション'));
    S.daily.missions.forEach((m) => {
      const def = AK.missionDef(m.id);
      if (!def) return;
      const pct = Math.min(1, m.prog / def.goal);
      const right = m.claimed ? h('span', { class: 'claimed' }, '受取済 ✔')
        : m.prog >= def.goal ? h('button', { class: 'btn small gold pulse', onclick: () => claimMission(m) }, '受け取る')
          : h('span', { class: 'mprog' }, `${Math.min(m.prog, def.goal)}/${def.goal}`);
      ms.append(h('div', { class: 'mission' + (m.claimed ? ' done' : '') },
        h('div', { class: 'm-main' }, h('div', { class: 'm-text' }, def.text), h('div', { class: 'bar' }, h('i', { style: { width: pct * 100 + '%' } }))),
        right));
    });

    const fields = [...Object.entries(AK.FIELDS), ['mix', { name: 'ミックス', icon: '🎲', color: '#64748b' }]];
    const grid = h('div', { class: 'field-grid' });
    fields.forEach(([id, F]) => {
      const st = id === 'mix' ? { a: S.stats.answered, c: S.stats.correct } : S.stats.byField[id];
      const n = id === 'mix' ? AK.QUESTIONS.length : AK.QUESTIONS.filter((q) => q.f === id).length;
      grid.append(h('button', {
        class: 'field-card', style: { '--fc': F.color },
        onclick: () => AK.Quiz.start({ mode: 'train', field: id, title: `修行：${F.name}` }),
      },
      h('div', { class: 'fc-icon' }, F.icon),
      h('div', { class: 'fc-name' }, F.name),
      h('div', { class: 'fc-sub' }, `${n}問｜正答率 ${st.a ? Math.round(st.c / st.a * 100) + '%' : '--'}`)));
    });
    const train = h('div', { class: 'panel' },
      h('h3', {}, '🌱 修行モード'),
      h('p', { class: 'hint' }, '1問正解するごとにアイテムGET！コンボを続けるとレアが出やすくなり、5コンボでFEVER（報酬2倍）🔥'),
      grid);

    const reviewQs = S.wrong.map(AK.qById).filter(Boolean);
    const challenge = h('div', { class: 'panel' },
      h('h3', {}, '⚔️ チャレンジ'),
      h('button', { class: 'wide-card kantei', onclick: () => AK.Quiz.start({ mode: 'kantei', timeLimit: 20, title: '🏅 鑑定競技モード' }) },
        h('div', { class: 'wc-icon' }, '🏅'),
        h('div', {}, h('div', { class: 'wc-title' }, '鑑定競技モード'),
          h('div', { class: 'wc-sub' }, `全分野から20問・1問20秒の本番形式｜ベスト ${S.best.kantei}/20`))),
      h('button', {
        class: 'wide-card review', disabled: !reviewQs.length,
        onclick: () => AK.Quiz.start({ mode: 'review', queue: AK.shuffle(reviewQs).slice(0, 10), title: '📕 復習ノート' }),
      },
      h('div', { class: 'wc-icon' }, '📕'),
      h('div', {}, h('div', { class: 'wc-title' }, `復習ノート（${reviewQs.length}問）`),
        h('div', { class: 'wc-sub' }, reviewQs.length ? '間違えた問題を克服するとボーナス報酬＆レア率UP！' : '間違えた問題がここにたまります'))));

    const b = AK.bossToday();
    const boss = h('button', {
      class: 'boss-card' + (b.won ? ' won' : ''), disabled: b.won,
      onclick: () => AK.Quiz.start({ mode: 'boss', title: `⚔️ ボス戦：${b.name}` }),
    },
    h('div', { class: 'bc-emoji' }, b.emoji),
    h('div', { class: 'bc-main' },
      h('div', { class: 'bc-label' }, b.won ? '✅ 本日討伐済み！明日は新たなボスが…' : '⚠️ 今日のボスが王国に襲来！'),
      h('div', { class: 'bc-name' }, b.name),
      h('div', { class: 'bc-sub' }, `HP ${b.hp}｜${b.field === 'mix' ? '全分野' : AK.FIELDS[b.field].name}の問題で攻撃！ハート3つ`)));

    v.append(h('div', { class: 'screen' }, boss, ms, train, challenge));
  };

  function claimMission(m) {
    if (m.claimed) return;
    m.claimed = true;
    AK.addCoins(50);
    const drops = AK.rollAndGive(1, 'mix', 6);
    const box = h('div', { class: 'reward' });
    AK.modal({ title: '📋 ミッション達成報酬！', body: box, buttons: [{ label: 'やったー！', cls: 'primary' }] });
    AK.showDrops(box, drops, '+50 💰');
    AK.addXP(20);
    AK.save();
    AK.refresh();
  }

  // ---------- 倉庫 ----------
  Screens.bag = function (v) {
    const S = AK.S;
    v.innerHTML = '';
    const wrap = h('div', { class: 'screen' });
    const groups = [['crop', '🌱 種・苗'], ['building', '🏗️ 施設'], ['deco', '🎨 かざり']];
    let any = false;
    groups.forEach(([type, label]) => {
      const ids = Object.keys(S.inv).filter((id) => S.inv[id] > 0 && AK.ITEMS[id] && AK.ITEMS[id].type === type).sort(byFieldRarity);
      if (!ids.length) return;
      any = true;
      wrap.append(h('div', { class: 'panel' }, h('h3', {}, label),
        h('div', { class: 'item-grid' }, ids.map((id) => {
          const i = AK.ITEMS[id];
          return h('button', { class: `item-card r-${i.rarity}${i.gold ? ' gold' : ''}`, onclick: () => AK.itemModal(id, { place: true }) },
            h('div', { class: 'ic-emoji' }, i.emoji),
            h('div', { class: 'ic-name' }, i.name),
            h('div', { class: 'ic-count' }, '×' + S.inv[id]));
        }))));
    });
    if (!any) {
      wrap.append(h('div', { class: 'panel empty' },
        h('div', { class: 'big' }, '🎒'),
        h('p', {}, '倉庫はからっぽ…'),
        h('p', {}, '問題に正解するとアイテムが手に入るよ！'),
        h('button', { class: 'btn primary', onclick: () => AK.go('quiz') }, '📝 問題を解きに行く')));
    }
    v.append(wrap);
  };

  // ---------- 図鑑 ----------
  let dexTab = 'veg';
  Screens.dex = function (v) {
    const S = AK.S;
    v.innerHTML = '';
    const tabs = [...Object.entries(AK.FIELDS).map(([id, F]) => [id, F.icon + F.name]), ['facility', '🏗️施設']];
    const inTab = (id) => {
      const i = AK.ITEMS[id];
      if (i.noDrop) return false;
      return dexTab === 'facility' ? i.type !== 'crop' : i.field === dexTab;
    };
    const all = Object.keys(AK.ITEMS).filter((id) => !AK.ITEMS[id].noDrop);
    const got = all.filter((id) => S.dex[id]).length;
    const ids = Object.keys(AK.ITEMS).filter(inTab).sort((a, b) => RAR_ORDER[AK.ITEMS[a].rarity] - RAR_ORDER[AK.ITEMS[b].rarity]);
    const tabGot = ids.filter((id) => S.dex[id]).length;

    v.append(h('div', { class: 'screen' },
      h('div', { class: 'panel' },
        h('h3', {}, `📖 アグリ図鑑　${got} / ${all.length}`),
        h('div', { class: 'bar big' }, h('i', { style: { width: (got / all.length * 100) + '%' } })),
        h('div', { class: 'tabs' }, tabs.map(([id, label]) => h('button', {
          class: 'tab' + (dexTab === id ? ' on' : ''),
          onclick: () => { dexTab = id; AK.Sound.play('tap'); Screens.dex(v); },
        }, label))),
        h('div', { class: 'small center' }, `このページ：${tabGot} / ${ids.length}`),
        h('div', { class: 'item-grid dex' }, ids.map((id) => {
          const i = AK.ITEMS[id], known = !!S.dex[id];
          return h('button', {
            class: `item-card r-${i.rarity}${known ? '' : ' unknown'}${known && i.gold ? ' gold' : ''}`,
            onclick: () => (known ? AK.itemModal(id) : AK.toast(`まだ見つけていない（${i.rarity}）。問題に正解して探そう！`)),
          },
          h('div', { class: 'ic-emoji' }, known ? i.emoji : '❓'),
          h('div', { class: 'ic-name' }, known ? i.name : '？？？'),
          h('div', { class: 'ic-count' }, i.rarity));
        })))));
  };

  // ---------- 記録 ----------
  Screens.rec = function (v) {
    const S = AK.S;
    v.innerHTML = '';
    const acc = S.stats.answered ? Math.round(S.stats.correct / S.stats.answered * 100) : 0;
    const profile = h('div', { class: 'panel profile' },
      h('div', { class: 'pf-icon' }, '🧑‍🌾'),
      h('div', {},
        h('div', { class: 'pf-name' }, S.name || 'ななしの農家'),
        h('div', { class: 'pf-title' }, `Lv.${S.level}　${AK.title(S.level)}`)),
      h('div', { class: 'pf-stats' },
        stat('解いた問題', S.stats.answered), stat('正解', S.stats.correct), stat('正答率', acc + '%'),
        stat('最大コンボ', S.stats.bestCombo), stat('収穫', S.stats.harvested), stat('連続ログイン', S.daily.streak + '日')));

    const fieldBars = h('div', { class: 'panel' }, h('h3', {}, '📊 分野別の正答率'),
      Object.entries(AK.FIELDS).map(([id, F]) => {
        const st = S.stats.byField[id], p = st.a ? st.c / st.a : 0;
        return h('div', { class: 'fbar' },
          h('div', { class: 'fbar-label' }, `${F.icon} ${F.name}`),
          h('div', { class: 'bar' }, h('i', { style: { width: p * 100 + '%', background: F.color } })),
          h('div', { class: 'fbar-num' }, st.a ? `${Math.round(p * 100)}%（${st.c}/${st.a}）` : '--'));
      }),
      h('p', { class: 'small' }, `苦手な問題（復習ノート）：${S.wrong.length}問`));

    const achN = AK.ACHIEVEMENTS.filter((a) => S.ach[a.id]).length;
    const ach = h('div', { class: 'panel' }, h('h3', {}, `🏆 実績　${achN} / ${AK.ACHIEVEMENTS.length}`),
      h('div', { class: 'ach-grid' }, AK.ACHIEVEMENTS.map((a) => h('div', { class: 'ach' + (S.ach[a.id] ? ' on' : '') },
        h('div', { class: 'ach-icon' }, S.ach[a.id] ? a.icon : '🔒'),
        h('div', { class: 'ach-name' }, a.name),
        h('div', { class: 'ach-desc' }, a.desc)))));

    const settings = h('div', { class: 'panel' }, h('h3', {}, '⚙️ 設定'),
      h('div', { class: 'set-row' },
        h('button', { class: 'btn small', onclick: renameDialog }, '✏️ 名前を変える'),
        h('button', { class: 'btn small', onclick: () => { S.settings.sound = !S.settings.sound; AK.save(); AK.refresh(); AK.emit('change'); } }, S.settings.sound ? '🔊 効果音ON' : '🔇 効果音OFF'),
        h('button', { class: 'btn small', onclick: exportDialog }, '💾 データ引き継ぎ'),
        h('button', { class: 'btn small danger', onclick: () => AK.confirm('本当にすべてのデータを消しますか？<br>この操作は元に戻せません。', AK.resetAll) }, '🗑️ データ削除')),
      h('p', { class: 'small' }, `問題数：${AK.QUESTIONS.length}問｜データはこの端末のブラウザに保存されます。`));

    let account = null;
    if (AK.Cloud.enabled && AK.Cloud.user) {
      const u = AK.Cloud.user;
      account = h('div', { class: 'panel' }, h('h3', {}, '☁️ アカウント'),
        h('p', { class: 'small' }, `${u.displayName || ''}（${u.email}）でログイン中。データはクラウドに自動保存されます。`),
        h('p', {}, '🏫 クラス：', h('b', {}, S.classId ? `${S.className}（${S.classId}）` : '未参加')),
        h('div', { class: 'set-row' },
          h('button', { class: 'btn small', onclick: () => AK.classDialog(() => AK.refresh()) }, S.classId ? '🏫 クラスを変更' : '🏫 クラスに参加'),
          h('button', { class: 'btn small', onclick: () => AK.Cloud.push(true).then(() => AK.toast('☁️ 保存しました')) }, '☁️ 今すぐ保存'),
          AK.Cloud.isTeacher() ? h('a', { class: 'btn small primary', href: 'teacher.html' }, '👨‍🏫 先生用ページ') : null,
          h('button', { class: 'btn small danger', onclick: () => AK.confirm('ログアウトしますか？', () => { AK.Cloud.signOut(); }) }, '🚪 ログアウト')));
    }
    const install = AK.canInstall() ? h('div', { class: 'panel' }, h('h3', {}, '📲 アプリとして使う'),
      h('p', { class: 'small' }, 'インストールすると、デスクトップやスタートメニューから全画面ですぐ起動できます。'),
      AK.installButton()) : null;

    v.append(h('div', { class: 'screen' }, profile, account, install, fieldBars, ach, settings));
  };

  // ---------- ランキング ----------
  const RANK_KINDS = [
    { id: 'week', label: '今週の正解', unit: '問', val: (r) => (r.weekKey === AK.weekKey() ? r.weekCorrect : 0) },
    { id: 'correct', label: '累計正解', unit: '問', val: (r) => r.correct },
    { id: 'kantei', label: '鑑定競技', unit: '/20', val: (r) => r.kantei },
    { id: 'level', label: 'レベル', unit: '', pre: 'Lv.', val: (r) => r.level },
    { id: 'dex', label: '図鑑', unit: '種', val: (r) => r.dex },
    { id: 'boss', label: 'ボス討伐', unit: '回', val: (r) => r.bossWins || 0 },
  ];
  let rankKind = 'week', rankCache = null;
  Screens.rank = function (v) {
    const S = AK.S;
    v.innerHTML = '';
    const wrap = h('div', { class: 'screen' });
    v.append(wrap);
    if (!S.classId) {
      wrap.append(h('div', { class: 'panel empty' },
        h('div', { class: 'big' }, '🏫'),
        h('p', {}, 'クラスに参加すると、クラスのランキングが見られるよ！'),
        h('button', { class: 'btn primary', onclick: () => AK.classDialog(() => { rankCache = null; AK.refresh(); }) }, 'クラスコードを入力')));
      return;
    }
    const kind = RANK_KINDS.find((k) => k.id === rankKind);
    const list = h('div', { class: 'rank-list' }, h('div', { class: 'small center' }, '読み込み中…'));
    wrap.append(h('div', { class: 'panel' },
      h('h3', {}, `🥇 ${S.className} ランキング`),
      h('div', { class: 'tabs' }, RANK_KINDS.map((k) => h('button', {
        class: 'tab' + (k.id === rankKind ? ' on' : ''),
        onclick: () => { rankKind = k.id; AK.Sound.play('tap'); Screens.rank(v); },
      }, k.label))),
      list,
      h('div', { class: 'center' }, h('button', { class: 'btn small', onclick: () => { rankCache = null; Screens.rank(v); } }, '🔄 更新'))));

    const draw = (rows) => {
      list.innerHTML = '';
      const sorted = rows.map((r) => Object.assign({ v: kind.val(r) || 0 }, r)).sort((a, b) => b.v - a.v);
      let rank = 0, prev = null;
      sorted.forEach((r, i) => {
        if (r.v !== prev) { rank = i + 1; prev = r.v; }
        const me = r.uid === (AK.Cloud.user && AK.Cloud.user.uid);
        list.append(h('div', { class: 'rank-row' + (me ? ' me' : '') + (rank <= 3 ? ' top' + rank : '') },
          h('div', { class: 'rk' }, rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : String(rank)),
          h('div', { class: 'rn' }, h('b', {}, r.name + (me ? '（あなた）' : '')), h('small', {}, `Lv.${r.level} ${r.title || ''}`)),
          h('div', { class: 'rv' }, `${kind.pre || ''}${r.v}${kind.unit}`)));
      });
      if (!sorted.length) list.append(h('div', { class: 'small center' }, 'まだだれもいません'));
    };
    if (rankCache && Date.now() - rankCache.t < 60000) { draw(rankCache.rows); return; }
    AK.Cloud.fetchRanking().then((rows) => { rankCache = { t: Date.now(), rows }; draw(rows); },
      () => { list.innerHTML = '<div class="small center">ランキングを読み込めませんでした（オフライン？）</div>'; });
  };
  const stat = (label, val) => h('div', { class: 'pf-stat' }, h('b', {}, String(val)), h('span', {}, label));

  function renameDialog() {
    const input = h('input', { class: 'text-input', value: AK.S.name, maxlength: 12 });
    AK.modal({
      title: '✏️ 名前を変える', body: input,
      buttons: [{ label: 'やめる' }, {
        label: '決定', cls: 'primary',
        onClick: () => { AK.S.name = input.value.trim() || AK.S.name; AK.save(); AK.refresh(); },
      }],
    });
    setTimeout(() => input.focus(), 50);
  }

  function exportDialog() {
    const out = h('textarea', { class: 'text-input code', readonly: true, rows: 3 });
    out.value = AK.exportSave();
    const inp = h('textarea', { class: 'text-input code', rows: 3, placeholder: 'ここに引き継ぎコードを貼り付け' });
    AK.modal({
      title: '💾 データ引き継ぎ',
      body: h('div', {},
        h('p', { class: 'small' }, '① 引き継ぎコード（コピーして別の端末へ）'), out,
        h('button', { class: 'btn small', onclick: () => { out.select(); (navigator.clipboard ? navigator.clipboard.writeText(out.value) : Promise.reject()).then(() => AK.toast('コピーしました'), () => document.execCommand('copy')); } }, '📋 コピー'),
        h('p', { class: 'small' }, '② 別の端末のコードを読み込む（今のデータは上書きされます）'), inp),
      buttons: [{ label: 'とじる' }, {
        label: '読み込む', cls: 'primary',
        onClick: () => {
          if (!inp.value.trim()) return false;
          try { AK.importSave(inp.value); } catch (e) { AK.toast('コードが正しくありません', 'bad'); return false; }
          return true;
        },
      }],
    });
  }
})(window.AK);
