// ===== ① ライブラリ（必ず一番上） =====
const express = require('express');
const line = require('@line/bot-sdk');
const cron = require('node-cron');
require('dotenv').config();

// ===== ② 初期設定 =====
const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

// ★ 自分のuserIdを入れる
const TARGET_USER_ID = 'ここに自分のuserId';

// ===== ③ 起動確認ログ =====
console.log("=== サーバー起動開始 ===");

// ===== Webhook =====
app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;

  await Promise.all(events.map(handleEvent));

  res.sendStatus(200);
});

// ===== ここを新しく追加 =====
async function handleEvent(event) {

  console.log("Webhook hit!");

  console.log("event:", JSON.stringify(event, null, 2));

  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  console.log("userId:", event.source.userId);

  return client.replyMessage(event.replyToken, {
    type: "text",
    text: "テスト返信"
  });
}

// ===== ⑤ cron（1分ごとテスト）=====
cron.schedule('* * * * *', async () => {
  console.log("⏰ cron発火");

  try {
    await client.pushMessage(TARGET_USER_ID, {
      type: 'text',
      text: 'cronテスト送信'
    });

    console.log("✅ LINE送信成功");
  } catch (error) {
    console.error("❌ LINE送信失敗:", error);
  }
});

// ===== ⑥ サーバー起動（必ず最後）=====
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

