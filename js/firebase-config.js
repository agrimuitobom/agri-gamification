/*
 * Firebase 設定（先生が編集するファイル）
 * ------------------------------------------------------------
 * 手順は docs/FIREBASE_SETUP.md を見てください。
 * FIREBASE_CONFIG が null のままだと、ログインなし（この端末だけに保存）で動きます。
 *
 * ※ この設定値は公開しても問題ありません（データの守りは firestore.rules で行います）。
 */
window.AK = window.AK || {};

// Firebase コンソール →「プロジェクトの設定」→「マイアプリ」の firebaseConfig をそのまま貼り付け
AK.FIREBASE_CONFIG = null;
/* 例：
AK.FIREBASE_CONFIG = {
  apiKey: 'AIza....',
  authDomain: 'xxxx.firebaseapp.com',
  projectId: 'xxxx',
  storageBucket: 'xxxx.appspot.com',
  messagingSenderId: '0000000000',
  appId: '1:0000000000:web:xxxxxxxx',
};
*/

// 先生のメールアドレス（クラス作成・ダッシュボードが使える人）。firestore.rules にも同じものを書く
AK.TEACHER_EMAILS = [
  // 'sensei@example.ed.jp',
];

// ログインできるメールのドメイン（例：'example.ed.jp'）。空文字ならどのGoogleアカウントでもOK
AK.ALLOWED_DOMAIN = '';
