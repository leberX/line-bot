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
    .then((result) => res.json(result));
});

const client = new line.Client(config);

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: event.message.text // Echo back the same message
  });
}

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

console.log("SECRET:", process.env.CHANNEL_SECRET);
console.log("TOKEN:", process.env.CHANNEL_ACCESS_TOKEN);
