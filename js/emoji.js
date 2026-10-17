/*
 * 絵文字 → 3D画像（Fluent Emoji / MIT License / img/emoji/LICENSE.txt）
 * ------------------------------------------------------------
 * 画面に表示された絵文字を自動で画像に置きかえる（端末ごとに絵柄が変わらないように）。
 * 新しい絵文字を使うときは img/emoji/ に画像を置き、下の一覧に追加する。
 * 一覧にない絵文字は、そのまま文字で表示される。
 */
(function (AK) {
  'use strict';
  AK.EMOJI_MAP = {
    '🏔': 'snow-capped-mountain',
    '⛰': 'mountain',
    '🌊': 'water-wave',
    '🏮': 'red-paper-lantern',
    '⭐': 'star',
    '🍁': 'maple-leaf',
    '🦋': 'butterfly',
    '🌙': 'crescent-moon',
    '🛠': 'hammer-and-wrench',
    '🔧': 'wrench',
    // オリジナルSVG（絵文字にない作物）。:名前: の形で items.js から使う
    ':sprinkler:': 'crops/sprinkler.svg',
    ':daikon:': 'crops/daikon.svg',
    ':cabbage:': 'crops/cabbage.svg',
    ':satoimo:': 'crops/satoimo.svg',
    ':wheat:': 'crops/wheat.svg',
    ':soba:': 'crops/soba.svg',
    ':sugarcane:': 'crops/sugarcane.svg',
    ':beet:': 'crops/beet.svg',
    ':cotton:': 'crops/cotton.svg',
    '🥬': 'leafy-green',
    '🧅': 'onion',
    '🧄': 'garlic',
    '🫛': 'pea-pod',
    '🍉': 'watermelon',
    '🎃': 'jack-o-lantern',
    '🌶': 'hot-pepper',
    '🫚': 'ginger-root',
    '🍈': 'melon',
    '🪻': 'hyacinth',
    '☘': 'shamrock',
    '🌵': 'cactus',
    '🪴': 'potted-plant',
    '🪷': 'lotus',
    '🍀': 'four-leaf-clover',
    '🫐': 'blueberries',
    '🌰': 'chestnut',
    '🍋': 'lemon',
    '🍏': 'green-apple',
    '🫒': 'olive',
    '🍍': 'pineapple',
    '🥭': 'mango',
    '🍄‍🟫': 'brown-mushroom',
    '🎋': 'tanabata-tree',
    '🎍': 'pine-decoration',
    '🛖': 'hut',
    '🏡': 'house-with-garden',
    '🏘': 'houses',
    '🥇': '1st-place-medal',
    '🥈': '2nd-place-medal',
    '🥉': '3rd-place-medal',
    '🎨': 'artist-palette',
    '👇': 'backhand-index-pointing-down',
    '🎒': 'backpack',
    '📊': 'bar-chart',
    '🧺': 'basket',
    '🫘': 'beans',
    '🪲': 'beetle',
    '🫑': 'bell-pepper',
    '🖤': 'black-heart',
    '🌼': 'blossom',
    '🐗': 'boar',
    '📚': 'books',
    '🥦': 'broccoli',
    '🐛': 'bug',
    '🏗': 'building-construction',
    '🎏': 'carp-streamer',
    '🥕': 'carrot',
    '🏰': 'castle',
    '✅': 'check-mark-button',
    '🍒': 'cherries',
    '🌸': 'cherry-blossom',
    '🐔': 'chicken',
    '📋': 'clipboard',
    '📕': 'closed-book',
    '☁': 'cloud',
    '☄': 'comet',
    '🏪': 'convenience-store',
    '🔄': 'counterclockwise-arrows-button',
    '🐄': 'cow',
    '🦗': 'cricket',
    '❌': 'cross-mark',
    '⚔': 'crossed-swords',
    '👑': 'crown',
    '😢': 'crying-face',
    '🥒': 'cucumber',
    '🗡': 'dagger',
    '🌳': 'deciduous-tree',
    '🦌': 'deer',
    '🚪': 'door',
    '🌽': 'ear-of-corn',
    '🍆': 'eggplant',
    '🌲': 'evergreen-tree',
    '🐑': 'ewe',
    '🧑‍🌾': 'farmer',
    '🔥': 'fire',
    '💪': 'flexed-biceps',
    '💾': 'floppy-disk',
    '⛲': 'fountain',
    '🎲': 'game-die',
    '⚙': 'gear',
    '🍇': 'grapes',
    '📗': 'green-book',
    '🌿': 'herb',
    '🌺': 'hibiscus',
    '⭕': 'hollow-red-circle',
    '🐝': 'honeybee',
    '🏠': 'house',
    '🏯': 'japanese-castle',
    '🥝': 'kiwi-fruit',
    '😵': 'knocked-out-face',
    '🐞': 'lady-beetle',
    '💡': 'light-bulb',
    '🔒': 'locked',
    '👨‍🏫': 'man-teacher',
    '📝': 'memo',
    '🦠': 'microbe',
    '🎖': 'military-medal',
    '📴': 'mobile-phone-off',
    '📲': 'mobile-phone-with-arrow',
    '💰': 'money-bag',
    '🎑': 'moon-viewing-ceremony',
    '🦟': 'mosquito',
    '🍄': 'mushroom',
    '🔇': 'muted-speaker',
    '📖': 'open-book',
    '📦': 'package',
    '🎉': 'party-popper',
    '🍑': 'peach',
    '🥜': 'peanuts',
    '🍐': 'pear',
    '✏': 'pencil',
    '🥔': 'potato',
    '🌈': 'rainbow',
    '🍎': 'red-apple',
    '❤': 'red-heart',
    '❓': 'red-question-mark',
    '🍞': 'bread',
    '🍠': 'roasted-sweet-potato',
    '🪨': 'rock',
    '🌹': 'rose',
    '🏵': 'rosette',
    '🏫': 'school',
    '📜': 'scroll',
    '🌱': 'seedling',
    '🌾': 'sheaf-of-rice',
    '🛡': 'shield',
    '⛩': 'shinto-shrine',
    '🐌': 'snail',
    '✨': 'sparkles',
    '🔊': 'speaker-high-volume',
    '🕷': 'spider',
    '🗓': 'spiral-calendar',
    '🏅': 'sports-medal',
    '⏱': 'stopwatch',
    '🍓': 'strawberry',
    '🌻': 'sunflower',
    '🌅': 'sunrise',
    '💦': 'sweat-droplets',
    '🍊': 'tangerine',
    '🍵': 'teacup-without-handle',
    '🍅': 'tomato',
    '🚜': 'tractor',
    '🏆': 'trophy',
    '🌷': 'tulip',
    '🌋': 'volcano',
    '⚠': 'warning',
    '🗑': 'wastebasket',
    '🪵': 'wood',
    '🗺': 'world-map',
    '🎁': 'wrapped-gift',
  };
  const BASE = 'img/emoji/';
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'SELECT', 'TITLE', 'CANVAS']);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 異体字セレクタ（U+FE0F）はあってもなくても一致させる
  const toPat = (k) => Array.from(k).map((ch) => esc(ch) + (ch === '\u200d' ? '' : '\uFE0F?')).join('');
  const keys = Object.keys(AK.EMOJI_MAP).sort((a, b) => b.length - a.length);
  const re = new RegExp(keys.map(toPat).join('|'), 'gu');

  AK.emojiSrc = (e) => {
    const slug = AK.EMOJI_MAP[e.replace(/\uFE0F/g, '')];
    if (!slug) return null;
    return slug.includes('/') ? 'img/' + slug : BASE + slug + '.webp';
  };

  function processText(node) {
    const t = node.nodeValue;
    re.lastIndex = 0;
    if (!t || !re.test(t)) return;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = re.exec(t))) {
      if (m.index > last) frag.append(t.slice(last, m.index));
      const img = document.createElement('img');
      img.className = 'emo';
      img.src = AK.emojiSrc(m[0]);
      img.alt = m[0];
      img.draggable = false;
      frag.append(img);
      last = m.index + m[0].length;
    }
    if (last < t.length) frag.append(t.slice(last));
    node.replaceWith(frag);
  }

  AK.emojify = function (root) {
    if (root.nodeType === 3) {
      if (root.parentNode && !SKIP.has(root.parentNode.nodeName)) processText(root);
      return;
    }
    if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (SKIP.has(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(processText);
  };

  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') AK.emojify(m.target);
      else m.addedNodes.forEach((n) => AK.emojify(n));
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  AK.emojify(document.body);

  /** 紙吹雪（canvas）用の画像。読み込み前は null（文字で描く） */
  const cache = {};
  // オリジナル画像は先に読み込んでおく（収穫演出で文字が出ないように）
  setTimeout(() => keys.filter((k) => k.startsWith(':')).forEach((k) => AK.emojiImage(k)), 0);
  AK.emojiImage = (e) => {
    const src = AK.emojiSrc(e);
    if (!src) return null;
    if (!cache[src]) { cache[src] = new Image(); cache[src].src = src; }
    return cache[src].complete && cache[src].naturalWidth ? cache[src] : null;
  };
})(window.AK);
