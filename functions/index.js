// 鍾家大宅：推播通知（在 Firebase 的伺服器上執行，不是在手機上）
//
// 資料庫一有新資料，這裡就會被叫起來，把通知送到相關成員的手機：
//   messages 新增 → 通知傳送者以外的所有成員
//   posts    新增 → 通知被標註的人
//   replies  新增 → 通知那則發言的作者
//
// 部署：在專案資料夾執行 firebase deploy --only functions

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
// 家用流量很小，限制同時執行的數量，避免程式出錯時產生意外費用
setGlobalOptions({ maxInstances: 3 });

const db = getFirestore();
const APP_URL = 'https://tzwen1225.github.io/family-app/';
const clip = (text) => (String(text || '').length > 120 ? String(text).slice(0, 120) + '…' : String(text || ''));

async function memberNames() {
  const snap = await db.collection('members').get();
  const names = {};
  snap.forEach((d) => { names[d.id] = d.data().display_name || '家人'; });
  return names;
}

// 把通知送到這些成員登記過的所有手機
async function notify(uids, title, body, tag) {
  const targets = [...new Set(uids)].filter(Boolean);
  if (!targets.length) return;
  const snap = await db.collection('push_tokens').where('uid', 'in', targets).get();
  if (snap.empty) return;

  const result = await getMessaging().sendEachForMulticast({
    tokens: snap.docs.map((d) => d.id),
    notification: { title, body },
    // 手機點通知後要開哪一頁，由 sw.js 依 tag 決定（chat → 聊天，post-… → 我有話要說）
    data: { title, body, tag, url: APP_URL },
    webpush: {
      headers: { Urgency: 'high', TTL: '86400' },
      notification: { icon: APP_URL + 'icons/icon-192.png', tag },
      fcmOptions: { link: APP_URL }
    }
  });

  // 已經失效的裝置代碼（例如 App 被刪除）順手清掉
  const dead = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
  await Promise.all(result.responses.map((r, i) => {
    if (r.success) return null;
    logger.warn('通知沒有送達', r.error && r.error.code);
    return r.error && dead.includes(r.error.code) ? snap.docs[i].ref.delete() : null;
  }));
  logger.info(`通知「${title}」：成功 ${result.successCount}，失敗 ${result.failureCount}`);
}

exports.onChatMessage = onDocumentCreated('messages/{id}', async (event) => {
  const m = event.data.data();
  const names = await memberNames();
  const others = Object.keys(names).filter((uid) => uid !== m.sender);
  await notify(others, names[m.sender] || '家人', clip(m.text), 'chat');
});

exports.onPost = onDocumentCreated('posts/{id}', async (event) => {
  const p = event.data.data();
  const names = await memberNames();
  const to = (p.to || []).filter((uid) => uid !== p.author);
  await notify(to, (names[p.author] || '家人') + '有話要對你說', clip(p.text), 'post-' + event.params.id);
});

exports.onReply = onDocumentCreated('replies/{id}', async (event) => {
  const r = event.data.data();
  const post = await db.collection('posts').doc(r.post_id).get();
  if (!post.exists || post.data().author === r.author) return;
  const names = await memberNames();
  await notify([post.data().author], (names[r.author] || '家人') + '回覆了你', clip(r.text), 'post-' + r.post_id);
});
