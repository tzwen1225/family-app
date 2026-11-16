# 鍾家大宅 — 家庭專用 App（第一版）

給四個人用的網頁式 App（PWA）。在 iPhone 的 Safari 打開後「加入主畫面」，用起來就像一般 App。
資料放在 Firebase（Authentication + Firestore），網頁放在 GitHub Pages。

功能：

- 電子郵件＋密碼登入，只有名單內的四個帳號能看到資料
- 月曆：內建補習、考試、家庭活動三種類型，可以標示是誰的事；全家都看得到，但只有新增的人可以修改或刪除；支援每週重複（例如固定的補習）；可切換成「近期」清單，最上面是考試倒數；成員生日會自動出現
- 首頁最上方顯示每個人是否上線，或最後上線的時間
- 聊天：全家一個聊天室，新訊息即時出現；每一則訊息都顯示有誰讀過；自己的訊息一小時內可以收回；可以搜尋最近 300 則訊息
- 我有話要說：對指定的人發話，只有被標註的人可以回覆；還沒回覆時分頁上會有紅點
- 雜記（在「金庫」分頁裡切換）：全家共用的筆記，可以置頂
- 零用錢記帳本（在「金庫」分頁，預設開啟）：每位小朋友一本，按月顯示零用錢、已花、還剩多少；家長可以記零用錢和修改任何一筆，小朋友只看得到自己的、只能記自己的支出
- 費用申請：小朋友可以提出「哪一天需要多少錢」，家長給了之後標示已給；零用錢頁有小月曆標出領錢、支出、需要費用的日期
- 考試科目：沒有內建科目，全部由家長在設定裡新增或刪除
- 考試成績（在「金庫」分頁）：依國一上到國三下六個學期分開；依科目顯示最近一次、進退步和平均；小朋友只看得到自己的，家長看得到兩位
- 聊天可以傳照片（自動壓縮；點縮圖看原圖）
- 投票（在「我有話要說」分頁）：發起問題和選項，全家投票，看得到誰選了什麼
- 採買清單（在「金庫」分頁）：全家共用，買了就打勾
- 資料卡（在「金庫」分頁）：健保卡號、學號、緊急聯絡人等，全家能看、家長能改
- 首頁今天的行程：家長看到今天全部的行程，小朋友只看到全家的和自己的；每一筆都標出是誰的事
- 首頁待辦事項：家長會看到還沒給的費用，所有人會看到「我有話要說」裡等自己回覆的發言
- 行事曆類型：除了內建的三種，家長可以在設定裡新增或刪除自訂類型
- 設定：每個人的基本資料（生日、電話、學校或公司、備註），有電話的可以直接撥打

- 推播通知：聊天有新訊息、被點名、被回覆時，手機會跳出通知（需要另外設定，見下方「推播通知」）

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
| `functions/` | 在 Firebase 伺服器上執行的推播通知程式 |
| `firebase.json`、`.firebaserc` | 部署設定（給 `firebase deploy` 用） |

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

`events`、`notes`、`messages`、`posts`、`replies`、`profiles`、`presence` 這些集合不用手動建立，第一次新增資料時會自動出現。

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
3. 從主畫面的「鍾家大宅」圖示打開，登入一次之後就會保持登入。

## 推播通知

通知由 Firebase 伺服器上的一小段程式（`functions/index.js`）發送，需要專案在 **Blaze 方案**。

### 1. 升級 Blaze 並設定預算警示

1. Firebase 後台左下角「升級」→ 選 Blaze → 綁定付款方式。
2. 升級流程中（或之後到 Google Cloud 的「帳單 → 預算與快訊」）設一個預算，例如 1 美元，有費用時會收到 email。

### 2. 產生推播金鑰

1. Firebase 後台 → 專案設定（齒輪）→「Cloud Messaging」分頁。
2. 捲到「網路設定」→「網路推播憑證」→「產生金鑰組」。
3. 複製那串金鑰，貼到 `js/config.js` 的 `vapidKey`。

### 3. 在電腦上部署（Windows）

1. 安裝 [Node.js](https://nodejs.org) 的 LTS 版本。
2. 把這個儲存庫下載到電腦：GitHub 頁面的綠色「Code」→ Download ZIP，解壓縮。
3. 在解壓後的資料夾空白處按住 Shift 點右鍵 →「在終端機中開啟」，依序執行：

```
npm install -g firebase-tools
firebase login
cd functions
npm install
cd ..
firebase deploy --only functions,firestore:rules
```

`firebase login` 會開瀏覽器，請用 Firebase 專案的那個 Google 帳號登入。
第一次部署會問是否啟用幾個必要的服務，都回答 Y；整個過程大約 3 到 5 分鐘。
這個指令會同時發布 `firebase/firestore.rules`，之後不必再手動貼規則。

### 4. 每支手機開啟通知

從主畫面的圖示開啟 App →「設定」→「開啟這支手機的通知」→ 系統詢問時按「允許」。
需要 iOS 16.4 以上；在 Safari 裡直接開的網頁不能收通知。

### 之後改了通知程式或規則

最簡單的方式：重新下載 ZIP、解壓縮，然後在資料夾裡對 `deploy.bat` 連按兩下。它會自動安裝需要的套件並部署通知程式和安全規則。

或者手動：
在同一個資料夾再執行一次 `firebase deploy --only functions,firestore:rules`。

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
