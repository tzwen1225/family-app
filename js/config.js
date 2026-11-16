// Firebase 連線設定。
// 來源：Firebase 後台 → 專案設定（齒輪）→ 一般 → 你的應用程式 → SDK 設定和配置。
//
// apiKey 留空時，App 會以「示範模式」執行：資料只存在這台裝置的瀏覽器裡。
// 這些設定值本來就會公開在網頁裡，資料是靠登入和 Firestore 安全規則保護的。
window.FAMILY_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyABvMFzYoLLS7aHbdLLo84m4qq1FS-qBx0',
    authDomain: 'chuang-e5b8e.firebaseapp.com',
    projectId: 'chuang-e5b8e',
    storageBucket: 'chuang-e5b8e.firebasestorage.app',
    messagingSenderId: '238056403641',
    appId: '1:238056403641:web:3e501ad4b9895f222e2168'
  },

  // 推播通知用的公開金鑰（VAPID key）。留空時 App 不會顯示開啟通知的按鈕。
  // 來源：Firebase 後台 → 專案設定 → Cloud Messaging → 網路設定 → 網路推播憑證 → 產生金鑰組。
  vapidKey: ''
};
