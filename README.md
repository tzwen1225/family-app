# 我們家 — 家庭專用 App（第一版）

給四個人用的網頁式 App（PWA）。在 iPhone 的 Safari 打開後「加入主畫面」，用起來就像一般 App。
資料放在 Firebase（Authentication + Firestore），網頁放在 GitHub Pages。

功能：

- 電子郵件＋密碼登入，只有名單內的四個帳號能看到資料
- 月曆：行程、考試、家庭活動、其他，可以標示是誰的事；可切換成「近期」清單，最上面是考試倒數
- 聊天：全家一個聊天室，新訊息即時出現，有未讀時分頁上會有紅點
- 雜記：全家共用的筆記，可以置頂
- 通訊錄：分類、搜尋，點電話圖示直接撥號

還沒做：推播通知（App 沒開著的時候不會跳出提醒）。

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | 入口頁 |
| `css/app.css` | 外觀 |
| `js/config.js` | **你要填的設定**（Firebase 的 firebaseConfig） |
| `js/api.js` | 讀寫資料（Firebase／示範模式） |
| `js/app.js` | 畫面與操作 |
| `sw.js`、`manifest.webmanifest`、`icons/` | 讓它能安裝到主畫面、離線也能開啟 |
| `vendor/firebase.js` | Firebase 官方 SDK 13.3.0（已打包好，不需另外下載） |
| `firebase/firestore.rules` | Firestore 安全規則 |

## 先試用（不需任何設定）

`js/config.js` 的 `apiKey` 留空時是示範模式：按「登入」即可進入，資料只存在那個瀏覽器裡。

## 設定 Firebase

以下都在 [Firebase 後台](https://console.firebase.google.com) 操作。可以用你現有的專案，也可以另開一個新專案。

### 1. 註冊網頁應用程式

專案設定（齒輪）→ 一般 → 你的應用程式 → 新增應用程式 → 網頁（`</>`）。
註冊後會顯示一段 `firebaseConfig`，把裡面的值貼進 `js/config.js`。

### 2. 開啟電子郵件登入，建立四個帳號

1. Authentication → 登入方式 → 啟用「電子郵件／密碼」。
2. Authentication → 使用者 → 新增使用者，輸入 email 和密碼。重複四次。
   孩子沒有信箱也沒關係，email 只是登入用的帳號名稱。
3. 記下每個帳號的**使用者 UID**（使用者列表裡那一欄），下一步會用到。

### 3. 建立 Firestore 與成員名單

1. Firestore Database → 建立資料庫（位置選 `asia-east1` 台灣；選正式版模式）。
2. 新增集合 `members`，為每位家人新增一份文件：
   - **文件 ID**：貼上那個人的使用者 UID（不要用自動 ID）
   - 欄位 `display_name`（string）：例如 `爸爸`
   - 欄位 `color`（string）：例如 `#2F6FDE`
   - 欄位 `sort`（number）：1、2、3、4，決定顯示順序

   建議顏色：爸爸 `#2F6FDE`、媽媽 `#C2478B`、女兒 `#E67E00`、兒子 `#1F8A5F`。

`events`、`notes`、`contacts`、`messages` 這些集合不用手動建立，第一次新增資料時會自動出現。

### 4. 貼上安全規則

Firestore Database → 規則 → 把 `firebase/firestore.rules` 整份貼上 → 發布。

這份規則的意思是：只有 UID 出現在 `members` 裡的帳號才能讀寫。
即使有人知道網址、甚至自己註冊了帳號，也看不到任何資料。

**每次 App 新增功能、`firestore.rules` 有更新時，都要重新貼上並發布一次**，否則新功能會讀寫失敗。

如果你的專案已經有其他資料和規則，不要整份覆蓋，把檔案裡的函式和各段 `match` 併進你現有的規則裡。

### 5.（選用）關閉自行註冊

Authentication → 設定 → 使用者動作，如果看得到「啟用建立（註冊）」的選項，可以關掉。
沒有這個選項也不影響安全，第 4 步的規則已經把非成員擋在外面。

## 放到 GitHub Pages

1. 把這個資料夾**裡面的**所有檔案放到儲存庫最上層（`index.html` 要在根目錄）。
2. 儲存庫 Settings → Pages → Source 選「Deploy from a branch」，Branch 選 `main` 和 `/ (root)`。
3. 一兩分鐘後網址是 `https://你的帳號.github.io/儲存庫名稱/`。

如果登入時出現網域未授權的錯誤，到 Authentication → 設定 → 已授權網域，加入 `你的帳號.github.io`。

## 裝到四支 iPhone

1. 用 **Safari** 打開網址。
2. 點分享按鈕 → **加入主畫面**。
3. 從主畫面的「我們家」圖示打開，登入一次之後就會保持登入。

## 需要知道的事

- **`js/config.js` 可以公開。** firebaseConfig 本來就會出現在網頁裡，資料靠登入和安全規則保護。服務帳戶金鑰（JSON 檔）絕對不要放進儲存庫。
- **改了程式之後**更新 GitHub 上的檔案即可。App 每次打開會優先抓最新版，離線時才用上一次的版本。
- **成員顏色與名稱**直接在 Firestore 的 `members` 文件裡改。
- **忘記密碼**：到 Authentication → 使用者，在該帳號的選單裡重設。

## 怎麼再擴充

每個新功能都是同一個模式：

1. 在 `firestore.rules` 加一段 `match`，用 `isFamily()` 保護，然後重新發布規則
2. 在 `js/api.js` 加讀寫函式（Firebase 版與示範版各一份）
3. 在 `js/app.js` 加一個分頁畫面

推播通知需要 Firebase Cloud Messaging，再加上一段在伺服器端發送通知的程式（Cloud Functions）。
