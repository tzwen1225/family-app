// 把 Firebase 後台給你的 firebaseConfig 整段貼到下面（步驟見 README.md）。
// 位置：Firebase 後台 → 專案設定（齒輪）→ 一般 → 你的應用程式 → SDK 設定和配置。
//
// apiKey 留空時，App 會以「示範模式」執行：資料只存在這台裝置的瀏覽器裡。
// 這些設定值本來就會公開在網頁裡，資料是靠登入和 Firestore 安全規則保護的。
window.FAMILY_CONFIG = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  }
};
