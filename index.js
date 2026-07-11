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

const { createClient } = require('@supabase/supabase-js');
const { type } = require('os');
const { log } = require('console');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
// ===== 初期設定 =====
const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

let lastReplyTime = Date.now();

// ===== 起動確認 =====
console.log("=== 健康チェックBot 起動 ===");

// ===== Webhook（返信処理）=====
app.post('/webhook', line.middleware(config), async (req, res) => {
  const startTime = Date.now();
  console.log("webhook in");
  const events = req.body.events;


  await Promise.all(events.map(handleEvent));

  console.log("全イベント処理成功");

  console.log("処理時間(ms) =", Date.now() - startTime);

  res.sendStatus(200);

  console.log("200送信");
});

app.get('/', (req, res) => {
  console.log("アクセスしました");
  res.send('OK');
});

// ===== メイン処理 =====
async function handleEvent(event) {

  console.log("① handleEvent開始");

  console.log("isRedelivery =", event.deliveryContext?.isRedelivery);

  if (event.deliveryContext?.isRedelivery) {
    console.log("再配送なのでスキップ");
    return;
  }

  if (event.type === 'follow') {
    console.log("案内^1");
    console.log("replyToken =", event.replyToken);
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

  const userId = event.source.userId;

  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!existingUser) {
    await supabase
      .from('users')
      .insert({
        user_id: userId,
        streak: 0,
        notified: false
      });
  }

  console.log("userId:", userId);
  const text = event.message.text.trim();

  if (text === "連携") {

    const code = Math.random()
      .toString(36)
      .substring(2, 8);

    console.log("生成コード：", code);

    await supabase
      .from("users")
      .update({
        link_code: code,
        role: "child"
      })
      .eq("user_id", userId);

    console.log("連携コード送信^2");
    console.log("replyToken =", event.replyToken);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `このコードを親に送ってください👇\n\n${code}`
    });
  }

  if (text.length === 6) {

    const code = text.trim();

    console.log("入力コード:", code);

    const { data: child, error } = await supabase
      .from("users")
      .select("*")
      .eq("link_code", code)
      .single();

    console.log("child:", child);

    if (!child) {
      console.log("コード間違い^3");
      console.log("replyToken =", event.replyToken);
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "❌ コードが間違っています"
      });
    }

    // 👇 子に親IDを登録
    await supabase
      .from("users")
      .update({
        parent_id: userId
      })
      .eq("user_id", child.user_id);

    // 👇 入力した側を親にする
    await supabase
      .from("users")
      .update({
        role: "parent"
      })
      .eq("user_id", userId);

    console.log("連携完了^4");
    console.log("replyToken =", event.replyToken);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "✅ 連携完了しました"
    });
  }

  lastReplyTime = Date.now();

  console.log("② text取得", text);

  const userMessage = event.message.text.trim();
  let replyText = "";



  let { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  // 👇 ユーザーが存在しなければ作る
  if (!user) {
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        user_id: userId,
        streak: 0,
        notified: false
      });

    if (insertError) {
      console.error("❌ 初回登録エラー", insertError);
    } else {
      console.log("✅ 新規ユーザー作成");
    }
  }

  if (error) {
    if (error.code === 'PGRST116') {
      console.log("🆕 新規ユーザー");
    } else {
      console.error("❌ 本当のDBエラー", error);
    }
  }

  if (!user) {
    user = {
      user_id: userId,
      streak: 0,
      last_reply_date: null,
      notified: false
    };
  }

  // ===== 健康チェック回答 =====
  if (userMessage === "1" || userMessage === "2" || userMessage === "3") {

    const today = getToday();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // ===== ストリーク計算 =====
    if (user.last_reply_date === yesterdayStr) {
      user.streak++;
    } else if (user.last_reply_date !== today) {
      user.streak = 1;
    }
    // 👆 今日すでに送ってる場合は何も変えない（でも処理は通す）
    user.last_reply_date = today;
  }

  // ===== 体調ごとの処理 =====
  if (userMessage === "1") {
    console.log("③ if(text==='1')入った");
    replyText = `お元気そうで何よりです♪　無理せずお過ごしくださいね！
現在 ${user.streak} 日連続です。`;
    console.log("③.5");

  } else if (userMessage === "2") {
    replyText = `ご返信ありがとうございます。無理せずお過ごしくださいね！
現在 ${user.streak} 日連続です。`;

  } else if (userMessage === "3") {

    // 👇 子を取得（配列になる）
    console.log("3-1");
    const { data: children, error } = await supabase
      .from("users")
      .select("user_id")
      .eq("parent_id", userId)
      .eq("role", "child");

    console.log("children:", children);


    if (!children || children.length === 0) {
      console.log("❌ 子がいない");
    } else {

      console.log("3-2");
      const child = children[0];

      console.log("送信先：", child?.user_id)

      try {
        await client.pushMessage(child.user_id, {
          type: "text",
          text: "⚠️ 親の体調が悪いと報告されました"
        });

        console.log("push成功");

      } catch (err) {
        console.error("push失敗");
        console.error("originalError =", err?.originalError);
        console.error("body =", err.body);
      };

      console.log("3-4");
      replyText = `少し心配です。今日はゆっくり休んでくださいね💦
  現在 ${user.streak} 日連続です。`;

      // ===== DB保存 =====
      console.log("3-5");
      const { error: saveError } = await supabase
        .from('users')
        .update({
          user_id: userId,
          streak: user.streak,
          last_reply_date: user.last_reply_date,
          notified: user.notified
        }, {
          onConflict: 'user_id'
        })
        .eq('user_id', userId);

      if (saveError) {
        console.error("❌ 保存エラー", saveError);
      } else {
        console.log("✅ 保存成功");
      }

      // 👇 ここに入れる（超重要）
      console.log("🔥 保存前", user);

      console.log("3-6");
      const { data, error } = await supabase
        .from("users")
        .update({
          role: user.role,
          parent_id: user.parent_id,
          streak: user.streak,
          last_reply_date: user.last_reply_date,
          notified: user.notified
        })
        .eq("user_id", userId)
        .select();
    }
  }

  console.log("④ reply直前");
  return client.replyMessage(event.replyToken, {
    type: "text",
    text: replyText
  })
};

// ===== cron（毎朝9時）=====
cron.schedule('0 9 * * *', async () => {
  console.log("⏰ 朝の健康チェック送信");
  console.log("現在時刻:", new Date().toString());

  const { data: parents, error } = await supabase
    .from("users")
    .select("*")
    .eq("role", "parent");

  if (error) {
    console.error("❌ 親取得失敗", error);
    return;
  }

  console.log("親人数 =", parents.length);

  for (const parent of parents) {
    try {
      await client.pushMessage(parent.user_id, {
        type: "text",
        text: `おはようございます☀️

今日の体調を教えてください

1:良い
2:普通
3:悪い`

      });
    } catch (err) {
      console.log("送信失敗");
    }
  }

},
  {
    timezone: "Asia/Tokyo"
  }
);

// ===== 未返信検知（3時間ごと）=====
cron.schedule('* * * * *', async () => {
  console.log("⏳ 未返信チェック");
  console.log("現在時刻:", new Date().toString());

  const LIMIT = 1 * 60 * 1000; // 24時間
  const now = Date.now();

  // ① 親を全員取得
  const { data: parents, error } = await supabase
    .from("users")
    .select("*")
    .eq("role", "parent");

  if (error) {
    console.error("❌ 親取得失敗", error);
    return;
  }

  console.log("親人数:", parents.length);

  // ② 親を1人ずつチェック
  for (const parent of parents) {
    // last_reply_dateが無ければスキップ
    if (!parent.last_reply_date) {
      console.log("返信履歴なし:", parent.user_id);
      continue;
    }

    const diff =
      now - new Date(parent.last_reply_date).getTime();

    console.log(
      "親:", parent.user_id,
      "経過時間:", Math.floor(diff / 1000), "秒"
    );

    // 24時間未返信 & 未通知
    if (diff > LIMIT && !parent.notified) {

      console.log("⚠️ 未返信発見");

      // ③ 子を取得
      const { data: child, error: childError } =
        await supabase
          .from("users")
          .select("user_id")
          .eq("role", "child")
          .eq("parent_id", parent.user_id)
          .single();

      if (childError || !child) {
        console.log("❌ 子が見つからない");
        continue;
      }

      // ④ 子へ通知
      await client.pushMessage(child.user_id, {
        type: "text",
        text: "⚠️ 24時間返信がないみたいです。"
      });

      console.log("child.user_id:", child.user_id);
      console.log("✅ 通知送信");


      // ⑤ notifiedをtrueにする
      const { error: updateError } = await supabase
        .from("users")
        .update({
          notified: true
        })
        .eq("user_id", parent.user_id);


      if (updateError) {
        console.error("❌ notified更新失敗", updateError);
      } else {
        console.log("✅ notified更新");
      }
    }
} {
    timezone: "Asia/Tokyo"
  }
});
// ===== サーバー起動 =====
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});