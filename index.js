// ===== ライブラリ =====
const express = require('express');
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

// ★ 自分のuserId
const TARGET_USER_ID = "Ucf5eea1d586f6afb69cccfd8248c2d75";

// ===== 起動確認 =====
console.log("=== 健康チェックBot 起動 ===");

// ===== Webhook（返信処理）=====
app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;
  await Promise.all(events.map(handleEvent));
  res.sendStatus(200);
});

// ===== メイン処理 =====
async function handleEvent(event) {

  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userMessage = event.message.text.trim();
  let replyText = "";

  // ===== 健康チェック回答 =====
  if (userMessage === "1") {
    replyText = "いいですね🔥 今日もその調子でいきましょう";
  } else if (userMessage === "2") {
    replyText = "OK、無理せず安定を意識していこう";
  } else if (userMessage === "3") {
    replyText = "少し心配です。今日はしっかり休むのも戦略です";
  } 

  // ===== その他 =====
  else if (userMessage.includes("疲れた")) {
    replyText = "それだけやってる証拠だ。一旦リセットしよう";
  } else if (userMessage.includes("眠い")) {
    replyText = "睡眠は最優先だ。今日は早く寝ろ";
  } else {
    replyText = "1〜3で体調を教えてください\n\n1:良い\n2:普通\n3:悪い";
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
    await client.pushMessage(TARGET_USER_ID, {
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

// ===== サーバー起動 =====
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});