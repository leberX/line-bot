require('dotenv').config();

const line = require('@line/bot-sdk');
const express = require('express');

const config = {
 channelAccessToken : process.env.TnHH3zKHY5+WVBgpcJSItSGhktAyo+N3GTyTAn2gUm5P8d/YHulBBN3/7cXuNrBi04yPv/fEdPqu2JOozFcb3h8Ge1S6uENqqCj57eOcq9hzuy7yLlZhO09eTyHmABtHJ7Apb/JbCoWnvLw6xU7YpAdB04t89/1O/w1cDnyilFU=
 channelSecret: process.env.b38df5570fa5d5e67443efcc5ef7fff4
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
