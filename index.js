require('dotenv').config();

const line = require('@line/bot-sdk');
const express = require('express');

const config = {
 channelAccessToken : process.env.CHANNEL_ACCESS_TOKEN,
 channelSecret : process.env.CHANNEL_SECRET,
};

const app = express();

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then(() => res.sendStatus(200))
    .catch(err => {
      console.error(err);
      res.sendStatus(500);
    });
});

const client = new line.Client(config);

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }//

  console.log("受信:",event.message.text);

  let replytext = '';
  if　(event.message.text === 'こんにちは！'){
      replytext = 'こんにちは！話しかけんなよ'
    } else if (event.message.text ==='おはよう')
        replytext = '起こしてんじゃねよ'
      else {
        replytext = '用がないのに話しかけんなよ'
      }

  return await client.replyMessage(event.replyToken, [
    {
    type: "text",
    text: "初めまして！あなたのお世話をするロボットです！"
  }
  ]);
}//

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log('Server running on port ${port}');
});

console.log("Bot is starting...");

