// ===== ライブラリ =====
const express = require('express');
console.log("サーバー起動開始");
const line = require('@line/bot-sdk');
const cron = require('node-cron');
require('dotenv').config();

// ===== 初期設定 =====
const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

let lastReplyTime = Date.now();

// 親のuserId
const PARENT_USER_ID = "U8143d9255c213e11a6132397c684a5ee";
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
let streak = 0;

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

  // ===== 健康チェック回答 =====
  if (userMessage === "1") {
    streak++;
    replyText =  `いいですね🔥体調がよくてなによりです！
現在 ${streak} 日連続です。`;
  } else if (userMessage === "2") {
    streak++;
    replyText = `無理せず、体調に合わせて過ごしてくださいね
    現在 ${streak} 日連続です。`;
  } else if (userMessage === "3") {
    let streak = 0;
    replyText = "少し心配です。今日はしっかり休みましょうね。";
  // 子供への通知
  await client.pushMessage(CHILD_USER_ID, {
      type: "text",
      text: "⚠️ 親の体調が『悪い』と報告されました"
    });
  }
  
  return client.replyMessage(event.replyToken, {
    type: "text",
    text: replyText
  });
}
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

  console.log("現在時刻:", new Date());
  console.log("最終返信:", new Date(lastReplyTime));
  console.log("差分(ms):", diff);

  // 24時間（ミリ秒）
  const LIMIT = 24 * 60 * 60 * 1000;

  if (diff > LIMIT) {
    try {
      await client.pushMessage(CHILD_USER_ID, {
        type: "text",
        text: "⚠️ 24時間返信がありません。確認してください。"
      });
      console.log("🚨 未返信通知送信");
    } catch (err) {
      console.error("❌ 未返信通知失敗", err);
    }
  }
});

// ===== サーバー起動 =====
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});