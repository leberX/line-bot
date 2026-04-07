require('dotenv').config();

const line = require('@line/bot-sdk');
const express = require('express');

const Config = {
 channelAccessToken : process.env.CHANNEL_ACCESS_TOKEN,
 channelSecret : process.env.CHANNEL_SECRET,
};

const App = express();

App.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then(() => res.sendStatus(200))
    .catch(err => {
      console.error(err);
      res.sendStatus(500);
    });
});

const Client = new line.Client(config);

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }//

  console.log("受信:",event.message.text);

  let replytext = '';
  if(event.message.text === 'こんにちは！'){
      replytext = 'こんにちは！調子はいかがでしょうか？'
    } else if (event.message.text ==='おはよう')
        replytext = 'おはようございます！今日も一日頑張りましょう！'
      else {
        replytext = 'まだ学習中です！'
      }

  return await client.replyMessage(event.replyToken, [
    {
    type: "text",
    text: replytext
  }
  ]);
}//

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log('Server running on port ${port}');
});

console.log("Bot is starting...");

const express = require('express');
const line = require('@line/bot-sdk');
const cron = require('node-cron');

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

// ======== 親のユーザーID（あとで取得する） ========
const TARGET_USER_ID = "ここに親のuserId";

// ======== Webhook（返信処理）========
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;

    await Promise.all(events.map(handleEvent));
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

cron.schedule('* * * * *', async () => {
  console.log("cron発火");

  try {
    await client.pushMessage(TARGET_USER_ID, {
      type: 'text',
      text: 'テスト送信:cron成功'
    });

    console.log("送信成功");
  } catch (error) {
    console.error("送信失敗", error);
  }
});

// ======== メッセージ処理 ========
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text;
  let replyText = "";

  if (userMessage === "1") {
    replyText = "【本日の体調】\n良い\n\n問題なさそうです 👍";
  } else if (userMessage === "2") {
    replyText = "【本日の体調】\n普通\n\n様子を見ましょう";
  } else if (userMessage === "3") {
    replyText = "【本日の体調】\n悪い\n\n注意が必要です";
  } else {
    replyText = "1〜3で入力してください";
  }

  return client.replyMessage(event.replyToken, {
    type: "text",
    text: replyText
  });
}

// ======== 毎朝9時に送信 ========
cron.schedule("0 9 * * *", async () => {
  console.log("⏰ 朝の健康チェック送信");

  try {
    await client.pushMessage(TARGET_USER_ID, {
      type: "text",
      text:
        "おはようございます ☀️\n\n今日の体調を教えてください\n\n1:良い\n2:普通\n3:悪い"
    });

    console.log("✅ 送信成功");
  } catch (error) {
    console.error("❌ 送信エラー:", error);
  }
});

// ======== サーバー起動 ========
const PORT= process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

console.log(event.source.userId);