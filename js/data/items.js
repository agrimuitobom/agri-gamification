/*
 * アイテムデータ
 * ------------------------------------------------------------
 * type: crop（植えて育てる） / building（効果つき施設） / deco（かざり）
 * rarity: N / R / SR / SSR
 * 果樹（perennial: true）は収穫しても木が残り、何度も収穫できる。
 */
window.AK = window.AK || {};

AK.RARITY = {
  N: { name: 'ノーマル' },
  R: { name: 'レア' },
  SR: { name: 'スーパーレア' },
  SSR: { name: 'レジェンド' },
};

(function () {
  // レア度ごとの成長時間（秒）・収穫コイン・収穫XP
  const GROW = { N: 45, R: 90, SR: 150, SSR: 240 };
  const COIN = { N: 10, R: 25, SR: 60, SSR: 200 };
  const XP = { N: 5, R: 12, SR: 30, SSR: 100 };

  const crop = (id, field, rarity, emoji, name, desc, extra) => [id, Object.assign(
    { type: 'crop', field, rarity, emoji, name, desc, grow: GROW[rarity], coin: COIN[rarity], xp: XP[rarity] },
    extra || {}
  )];
  const tree = (id, rarity, emoji, name, desc, extra) => crop(id, 'fruit', rarity, emoji, name, desc, Object.assign({ perennial: true }, extra));
  const obj = (id, type, rarity, emoji, name, desc, effect, effectText, extra) => [id, Object.assign(
    { type, rarity, emoji, name, desc, effect: effect || null, effectText: effectText || '' },
    extra || {}
  )];

  AK.ITEMS = Object.fromEntries([
    // ---------- 野菜 ----------
    crop('tomato', 'veg', 'N', '🍅', 'トマト', 'ナス科。南米アンデス原産。赤い色素はリコピン。わき芽をかいて主枝1本仕立てにするのが基本。'),
    crop('cucumber', 'veg', 'N', '🥒', 'キュウリ', 'ウリ科。インド原産。生育が早く、開花から1週間ほどで収穫できる。単為結果性をもつ。'),
    crop('eggplant', 'veg', 'N', '🍆', 'ナス', 'ナス科。インド原産。高温性で乾燥に弱い。花の形（長花柱花・短花柱花）で栄養状態を判断できる。'),
    crop('carrot', 'veg', 'N', '🥕', 'ニンジン', 'セリ科。好光性種子なので覆土は薄く。オレンジ色はβ-カロテン。'),
    crop('broccoli', 'veg', 'R', '🥦', 'ブロッコリー', 'アブラナ科。食べているのは花蕾（つぼみ）の集まり。頂花蕾を収穫した後、側花蕾も収穫できる品種がある。'),
    crop('pepper', 'veg', 'R', '🫑', 'ピーマン', 'ナス科トウガラシ属。辛味のないトウガラシの仲間。高温を好む。'),
    crop('strawberry', 'veg', 'SR', '🍓', 'イチゴ', 'バラ科。野菜（果菜類）として扱われる。食べる部分は花托が肥大したもの。ランナーで増やす。'),
    crop('goldtomato', 'veg', 'SSR', '🍅', '黄金のトマト', '伝説の品種。あらゆる栽培技術を極めた者だけが育てられるという…。', { gold: true }),

    // ---------- 草花 ----------
    crop('tulip', 'flower', 'N', '🌷', 'チューリップ', 'ユリ科。秋植え球根の代表。球根はりん茎。低温にあたらないと花茎が伸びない。'),
    crop('sunflower', 'flower', 'N', '🌻', 'ヒマワリ', 'キク科。春まき一年草。花に見えるのは小さな花が集まった頭状花序。'),
    crop('marigold', 'flower', 'N', '🌼', 'マリーゴールド', 'キク科。春まき一年草。センチュウを抑える対抗植物としても使われる。'),
    crop('chrysanthemum', 'flower', 'N', '🏵️', 'キク', 'キク科。短日植物。電照栽培やシェード栽培で一年中出荷される、日本の切り花生産量No.1。'),
    crop('rose', 'flower', 'R', '🌹', 'バラ', 'バラ科。切り花・鉢物・庭木として人気。四季咲き性の品種が多く、接ぎ木で増やす。'),
    crop('hibiscus', 'flower', 'R', '🌺', 'ハイビスカス', 'アオイ科。熱帯の花木。オクラと同じ仲間で花の形がよく似ている。'),
    crop('sakura', 'flower', 'SR', '🌸', 'サクラ', 'バラ科の花木。ソメイヨシノは接ぎ木で増やされたクローン。'),
    crop('rainbowrose', 'flower', 'SSR', '🌹', '虹色のバラ', '伝説の花。花弁に吸わせる染色液の技術で、七色に輝く。', { gold: true }),

    // ---------- 果樹 ----------
    tree('apple', 'N', '🍎', 'リンゴ', 'バラ科。仁果類。自家不和合性のため受粉樹や人工受粉が必要。主産地は青森県・長野県。'),
    tree('mikan', 'N', '🍊', 'ウンシュウミカン', 'ミカン科。カラタチ台木に接ぎ木。主産地は和歌山県・愛媛県・静岡県。'),
    tree('grape', 'N', '🍇', 'ブドウ', 'ブドウ科。しょう果類。ジベレリン処理で種なしにできる。主産地は山梨県・長野県。'),
    tree('pear', 'N', '🍐', 'ナシ', 'バラ科。仁果類。日本ナシは棚仕立てが多い。梵天で人工受粉する。'),
    tree('peach', 'R', '🍑', 'モモ', 'バラ科。核果類。開心自然形で仕立てる。主産地は山梨県・福島県。'),
    tree('kiwi', 'R', '🥝', 'キウイフルーツ', 'マタタビ科。雌雄異株なので雄木が必要。収穫後に追熟させて食べる。'),
    tree('cherry', 'SR', '🍒', 'オウトウ（サクランボ）', 'バラ科。核果類。雨で裂果しやすいので雨よけ栽培が多い。主産地は山形県。'),
    tree('goldapple', 'SSR', '🍎', '黄金のリンゴ', '神話に登場する伝説の果実。食べると知恵がつくとか、つかないとか。', { gold: true }),

    // ---------- 作物 ----------
    crop('rice', 'crop', 'N', '🌾', 'イネ', 'イネ科。日本の主食。塩水選→浸種→催芽→播種→育苗→田植え→中干し→出穂→登熟→収穫。'),
    crop('corn', 'crop', 'N', '🌽', 'トウモロコシ', 'イネ科。C4植物。雄穂と雌穂が分かれて咲く雌雄異花。'),
    crop('potato', 'crop', 'N', '🥔', 'ジャガイモ', 'ナス科。食用部分は塊茎。芽や緑化した部分にはソラニンが含まれる。'),
    crop('sweetpotato', 'crop', 'N', '🍠', 'サツマイモ', 'ヒルガオ科。食用部分は塊根。やせ地でも育ち、つる苗を挿して植える。'),
    crop('soybean', 'crop', 'R', '🫘', 'ダイズ', 'マメ科。「畑の肉」。根粒菌と共生し、空気中の窒素を固定する。'),
    crop('peanut', 'crop', 'R', '🥜', 'ラッカセイ', 'マメ科。花が咲いた後、子房柄が地中にもぐって莢をつくる。千葉県が主産地。'),
    crop('tea', 'crop', 'SR', '🍵', 'チャ', 'ツバキ科の工芸作物。新芽を摘んで緑茶・紅茶・ウーロン茶に加工する。'),
    crop('goldrice', 'crop', 'SSR', '🌾', '黄金の稲穂', '豊作の神が宿るといわれる伝説の稲穂。', { gold: true }),

    // ---------- 施設 ----------
    obj('house', 'building', 'N', '🏠', '農家の家', 'あなたの王国のはじまりの場所。', null, '', { noDrop: true }),
    obj('sprinkler', 'building', 'R', '💦', 'スプリンクラー', '散水かんがい装置。水やりを自動化して省力化できる。', 'speed', '周囲8マスの作物の成長が1.5倍速'),
    obj('beehive', 'building', 'R', '🐝', 'ミツバチの巣箱', 'ミツバチは果樹やイチゴなどの受粉を助けるポリネーター（花粉媒介昆虫）。ハチミツもとれる！', 'coin', '周囲8マスの収穫コイン1.5倍'),
    obj('scarecrow', 'building', 'R', '🧑‍🌾', 'かかし', '鳥獣から作物を守る。実際の病害虫対策は、防虫ネット・輪作・天敵利用などを組み合わせる（IPM：総合的病害虫管理）。', 'guard', '周囲8マスで病害虫が発生しなくなる'),
    obj('compost', 'building', 'SR', '🐄', '堆肥舎', '家畜ふんを発酵させた堆肥は、土の団粒構造をつくり地力を高める。耕畜連携！', 'xp', '周囲8マスの収穫XP1.5倍'),
    obj('shop', 'building', 'SR', '🏪', '農産物直売所', '生産者が直接販売する直売所。加工・販売まで手がける6次産業化の拠点にもなる。', 'shop', '王国全体の収穫コイン+20%（3つまで重複）'),
    obj('tractor', 'building', 'SR', '🚜', 'トラクター', '耕うん・代かき・運搬などに使う農業機械。PTO軸で作業機に動力を伝える。', 'harvestAll', '王国に置くと「一括収穫」ができる'),
    obj('castle', 'building', 'SSR', '🏯', '王国の城', 'あなたの王国のシンボル。農業王の証。', 'castle', '王国全体の収穫コイン・XP +30%'),

    // ---------- かざり ----------
    obj('keyaki', 'deco', 'N', '🌳', 'ケヤキ', '屋敷林や防風林として、農地や家を風から守ってきた。'),
    obj('sugi', 'deco', 'N', '🌲', 'スギ', '日本の林業を代表する針葉樹。'),
    obj('rock', 'deco', 'N', '🪨', '岩', '庭のアクセント。'),
    obj('logs', 'deco', 'N', '🪵', '薪の山', '間伐材は薪やシイタケの原木として利用される。'),
    obj('chicken', 'deco', 'R', '🐔', 'ニワトリ', '採卵鶏は1日におよそ1個の卵を産む。鶏ふんは良い肥料になる。'),
    obj('sheep', 'deco', 'R', '🐑', 'ヒツジ', '羊毛や羊肉をとるために飼われる。'),
    obj('koinobori', 'deco', 'R', '🎏', 'こいのぼり', '端午の節句のかざり。子どもの健やかな成長を願う。'),
    obj('torii', 'deco', 'SR', '⛩️', '鳥居', '豊作を祈る神社の入口。秋祭りは収穫に感謝する祭り。'),
    obj('fountain', 'deco', 'SR', '⛲', '噴水', '王国の広場をいろどる噴水。'),
  ]);

  // 旬（主な収穫時期・月）。現実のカレンダーで旬の作物は成長1.5倍・コイン1.5倍
  const SEASON = {
    tomato: [6, 7, 8, 9], cucumber: [6, 7, 8], eggplant: [6, 7, 8, 9], carrot: [4, 5, 6, 7, 11, 12],
    broccoli: [11, 12, 1, 2, 3], pepper: [6, 7, 8, 9], strawberry: [12, 1, 2, 3, 4, 5],
    tulip: [3, 4, 5], sunflower: [7, 8, 9], marigold: [5, 6, 7, 8, 9, 10], chrysanthemum: [9, 10, 11],
    rose: [5, 6, 10, 11], hibiscus: [6, 7, 8, 9], sakura: [3, 4],
    apple: [9, 10, 11, 12], mikan: [10, 11, 12, 1], grape: [8, 9, 10], pear: [8, 9, 10],
    peach: [7, 8], kiwi: [10, 11, 12], cherry: [6, 7],
    rice: [9, 10], corn: [6, 7, 8], potato: [6, 7, 8, 9], sweetpotato: [9, 10, 11],
    soybean: [10, 11], peanut: [9, 10], tea: [4, 5],
  };
  Object.entries(SEASON).forEach(([id, m]) => { AK.ITEMS[id].season = m; });
})();

/*
 * ボス（日替わり）。field の問題で戦う（mix は全分野）
 */
AK.BOSSES = [
  { id: 'yotou', emoji: '🐛', name: 'ヨトウムシ将軍', field: 'veg', desc: '昼は土の中にかくれ、夜に出てきて野菜の葉を食い荒らすヨトウガの幼虫。' },
  { id: 'imochi', emoji: '🦠', name: 'いもち病の魔王', field: 'crop', desc: 'イネの大敵。低温・多湿・窒素過多で大発生する糸状菌（カビ）。' },
  { id: 'kamemushi', emoji: '🪲', name: 'カメムシ軍団長', field: 'fruit', desc: '果樹カメムシ類は果実の汁を吸い、変形果や落果の原因になる。' },
  { id: 'hadani', emoji: '🕷️', name: 'ハダニ女王', field: 'flower', desc: '高温・乾燥で大増殖。葉の裏から汁を吸い、葉がかすり状に白くなる。' },
  { id: 'inoshishi', emoji: '🐗', name: '暴れイノシシ', field: 'mix', desc: '鳥獣による農作物被害は全国で深刻。電気柵や防護柵で農地を守る。' },
  { id: 'unka', emoji: '🦟', name: 'ウンカの大群', field: 'crop', desc: '梅雨どきに海外から気流に乗って飛来し、イネの株元で汁を吸う。' },
  { id: 'shika', emoji: '🦌', name: 'シカの群れ', field: 'mix', desc: '新芽や樹皮を食べ、果樹や林業にも大きな被害を出す。' },
];
