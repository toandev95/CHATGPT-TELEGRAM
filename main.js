import _ from "lodash";
import DotENV from "dotenv";
import { Telegraf } from "telegraf";
import { ChatGPTAPI } from "chatgpt";
import log from "fancy-log";
import moment from "moment";
import { oraPromise } from "ora";

DotENV.config();

const bot = new Telegraf(process.env.BOT_TOKEN, {
  handlerTimeout: 180000,
});

const api = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
});

const convs = {
  // xxxx: {
  //   conversationId: null,
  //   parentMessageId: null,
  // },
};

(async () => {
  bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;

    if (_.isNil(convs[id])) {
      await ctx.sendChatAction("typing");
      await ctx.reply(`Chào ${first_name || username}.`);
    }

    await ctx.sendChatAction("typing");
    await ctx.reply("Hãy nói điều gì đó với ChatGPT.");

    log("User ID:", id);
  });

  bot.on("message", async (ctx) => {
    const { id } = ctx.from;
    const { text: prompt } = ctx.message;

    await ctx.sendChatAction("typing");

    try {
      let ll = moment();

      const {
        //
        conversationId,
        parentMessageId,
        text,
      } = await oraPromise(
        api.sendMessage(prompt, {
          promptPrefix: [
            "You are ChatGPT, a large language model trained by OpenAI.",
            "You can answer freely based on your trained knowledge.",
          ].join(" "),
          ...(!_.isNil(convs[id])
            ? {
                conversationId: convs[id].conversationId,
                parentMessageId: convs[id].parentMessageId,
              }
            : {}),
          onProgress: async () => {
            if (moment().diff(ll, "second") <= 3) {
              return;
            }

            ll = moment();

            await ctx.sendChatAction("typing");
          },
          timeoutMs: 160000,
        }),
        {
          text: `ChatGPT: ${prompt}`,
          successText: `ChatGPT: ${prompt} - Xong`,
          failText: `ChatGPT: ${prompt} - Lỗi`,
        }
      );

      convs[id] = { conversationId, parentMessageId };

      await ctx.reply(text, { parse_mode: "Markdown" });
    } catch (error) {
      log.error(error);

      await ctx.reply("Sự cố ChatGPT, vui lòng liên hệ @toandev");
    }
  });

  await bot.launch();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
})();
