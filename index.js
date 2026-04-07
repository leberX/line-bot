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

// ===== ④ Webhook（LINEからの受信）=====
app.post('/webhook', line.middleware(config), async (req, res) => {
  console.log("Webhook受信");

  try {
    const events = req.body.events;
    console.log("イベント数:", events.length);

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhookエラー:", err);
    res.sendStatus(500);
  }
});

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