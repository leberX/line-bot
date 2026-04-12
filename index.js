// ===== ライブラリ =====
const express = require('express');
console.log("サーバー起動開始");
const line = require('@line/bot-sdk');
let streak = 0;
let lastReplyDate = null;

function getToday() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}
const cron = require('node-cron');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
// 👇 ここ
const DATA_FILE = path.join(__dirname, 'data.json');
// ===== 初期設定 =====
const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

let userData = {};

if (fs.existsSync(DATA_FILE)) {
  const data = fs.readFileSync(DATA_FILE, 'utf-8');
  userData = JSON.parse(data);
}

try {
  const data = fs.readFileSync('data.json', 'utf-8');
  userData = JSON.parse(data);
} catch (e) {
  userData = {};
}

function saveData() {
  try {
  fs.writeFileSync('data.json', JSON.stringify(userData, null, 2));
console.log("💾 保存成功");
  } catch (err) {
    console.error("❌ 保存失敗", err);
  }
}

let lastReplyTime = Date.now();

// 親のuserId
const PARENT_USER_ID = "Ucf5eea1d586f6afb69cccfd8248c2d75";
// 子供のuserId
const CHILD_USER_ID = "Ucf5eea1d586f6afb69cccfd8248c2d75";
// ===== 起動確認 =====
console.log("=== 健康チェックBot 起動 ===");

// ===== Webhook（返信処理）=====
app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;
  await Promise.all(events.map(handleEvent));
  res.sendStatus(200);
});

app.get('/', (req, res) => {
  console.log("アクセスしました");
  res.send('OK');
});

// ===== メイン処理 =====
async function handleEvent(event) {

  if (event.type === 'follow') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `このLINEは、あなたの体調を簡単に確認するためのものです。

もし体調が悪い日や、返信がない日が続いた場合、
ご家族に通知が届く仕組みになっています。

あなたの安心と、ご家族の安心のための仕組みです。
無理のない範囲で、「1・2・3」で教えてください。`
    });
  }

  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }
  console.log("ユーザーID:", event.source.userId);
  
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  lastReplyTime = Date.now();

  let notified = false;

  const userMessage = event.message.text.trim();
  let replyText = "";

  const userId = event.source.userId;

// 👇 初期化（ここ）
if (!userData[userId]) {
  userData[userId] = {
    streak: 0,
    lastReplyDate: null,
    notified: false
  };
}

// 👇 user取得（ここ）
const user = userData[userId];

// 👇 リセット（ここ）
user.notified = false;
saveData();

if (!userData[userId]) {
  userData[userId] = {
    streak: 0,
    lastReplyDate: null,
    notified: false
  };
}
// ===== 健康チェック回答 =====
if (userMessage === "1" || userMessage === "2") {

  const today = getToday();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (user.lastReplyDate === today) {
    replyText = `今日はすでに記録済みです👌
現在 ${user.streak} 日連続です。`;

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: replyText
    });
  }

  if (user.lastReplyDate === yesterdayStr) {
    user.streak++;
  } else {
    user.streak = 1;
  }

  user.lastReplyDate = today;
  saveData();

  replyText = `いいですね🔥
現在 ${user.streak} 日連続です。`;

} else if (userMessage === "3") {

  const today = getToday();

  user.streak = 0;
  user.lastReplyDate = today;

  saveData();

  // 👇 通知はここだけ！！
  await client.pushMessage(CHILD_USER_ID, {
    type: "text",
    text: "⚠️ 親の体調が『悪い』と報告されました"
  });

  replyText = "少し心配です。今日はしっかり休みましょうね。";
}}
// ===== cron（毎朝9時）=====
cron.schedule('0 9 * * *', async () => {
  console.log("⏰ 朝の健康チェック送信");

  try {
    await client.pushMessage(PARENT_USER_ID, {
      type: "text",
      text: `おはようございます☀️

今日の体調を教えてください

1:良い
2:普通
3:悪い`
    });

    console.log("✅ 送信成功");
  } catch (error) {
    console.error("❌ 送信失敗:", error);
  }
});
// ===== 未返信検知（1時間ごと）=====
cron.schedule('* * * * *', async () => {

  console.log("⏳ 未返信チェック");

  const now = Date.now();
  const diff = now - lastReplyTime;

  const LIMIT = 24 * 60 * 60 * 1000; // 24時間

  const user = userData[PARENT_USER_ID];

  // 👇 これ絶対必要
  if (!user) {
    console.log("❌ userが存在しない");
    return;
  }

  if (diff > LIMIT && !user.notified) {

    try {
      await client.pushMessage(CHILD_USER_ID, {
        type: "text",
        text: "⚠️ 24時間返信がありません。確認してください。"
      });

      user.notified = true;
      saveData();

      console.log("🚨 未返信通知送信（1回のみ）");

    } catch (err) {
      console.error("❌ 未返信通知失敗", err);
    }
  }
});
  
 user.notified = true;
 saveData();
// ===== サーバー起動 =====
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});