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
    console.log("webhook in");
    const events = req.body.events;
try {
    await Promise.all(events.map(handleEvent));

    console.log("全イベント処理成功");

} catch (err) {
  console.error("Promise.all失敗", err);

  console.error("err =", err);

  console.error("message =", err?.message);

  console.error("stack =", err?.stack);
}
    res.sendStatus(200);
    console.log("200送信");
  
});

app.get('/', (req, res) => {
  console.log("アクセスしました");
  res.send('OK');
});

// ===== メイン処理 =====
async function handleEvent(event) {
  console.log("======== HANDLE EVENT START ========");

  console.log("isRedelivery =",event.deliveryContext?.isRedelivery);

  console.log("webhookEventId =", event.webhookEventId);

  console.log("type =", event.type);

  console.log("replyToken =", event.replyToken);

  console.log("timestamp =", event.timestamp);

  console.log("source =", event.source);

  console.log("message.id =", event.message?.id);
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

      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "✅ 連携完了しました"
      });
    }

    lastReplyTime = Date.now();

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
        replyText = `最高だな🔥
現在 ${user.streak} 日連続です。`;

      } else if (userMessage === "2") {
        replyText = `いい感じだ👌
現在 ${user.streak} 日連続です。`;

      } else if (userMessage === "3") {

        // 👇 子を取得（配列になる）
        const { data: children, error } = await supabase
          .from("users")
          .select("user_id")
          .eq("parent_id", userId)
          .eq("role", "child");

        console.log("children:", children);


        if (!children || children.length === 0) {
          console.log("❌ 子がいない");
        } else {

          const child = children[0];

           console.log("送信先：", child?.user_id)

          try {
            await client.pushMessage(child.user_id, {
              type: "text",
              text: "⚠️ 親の体調が悪いと報告されました"
            });

            console.log("push成功");

            replyText = `少し心配です。今日はゆっくり休んでくださいね💦
  現在 ${user.streak} 日連続です。`;
          } catch (err) {
            console.error("push失敗", err);
            console.log("err.response?.data =", err.response?.data);
            console.log("original response =", err.originalError?.response?.data);
            replyText = "failed to send message!!";
          } finally {

            console.log("END",event.webhookEventId);

          }

          // ===== DB保存 =====
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

          console.log("💾 data:", data);
          console.log("💾 error:", error);

          if (error) {
            console.error("❌ 保存エラー", error);
          } else {
            console.log("✅ 保存成功", data);
          }
        }
        try {

  const result = await client.replyMessage(event.replyToken,{
      type: "text",
      text: replyText
    }
  );

  console.log("reply成功", result);

} catch(err) {

  console.log("reply失敗");

  console.log("response =", err.response?.data);

  console.log("original =",err.originalError?.response?.data);

  throw err;
}};
      

  console.error("handleEvent Error:", err);

  if (err.response) {
    console.log("ステータス 'status' =", err.response.status);
    console.log("データ 'data' =", err.response.data);
  }

  console.log("END", event.webhookEventId);
};

    // ===== cron（毎朝9時）=====
    cron.schedule('0 9 * * *', async () => {
      console.log("⏰ 朝の健康チェック送信");

      try {
        await client.pushMessage(user.parent_id, {
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
    // ===== 未返信検知（3時間ごと）=====
    cron.schedule('0 */3 * * *', async () => {

      console.log("⏳ 未返信チェック");

      const now = Date.now();
      const diff = now - lastReplyTime;

      const LIMIT = 24 * 60 * 60 * 1000; // 24時間

      const { data: user, error } = await supabase
      .from("users")
      .select("*")

      console.log("取得人数:", data ? data.length : 0);

      // 👇 これ絶対必要
      if (!user) {
        console.log("❌ userが存在しない");
        return;
      }

      try {

        if (diff > LIMIT && !user.notified) {

          if (child) {
            await client.pushMessage(child.user_id, {
              type: "text",
              text: "⚠️ 24時間返信がないみたいです"
            });
          }
          user.notified = true;

          console.log("🚨 未返信通知送信(1回のみ)");
        }

      } catch (err) {
        console.error("❌ 未返信通知失敗", err);
      }
    });
    // ===== サーバー起動 =====
    const port = process.env.PORT || 3000;

    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });