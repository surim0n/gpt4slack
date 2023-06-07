javascript
require('dotenv').config();
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const { App, ExpressReceiver } = require("@slack/bolt");
const rateLimit = require('express-rate-limit');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
});

app.use("/s", receiver.router);

const slackApp = new App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver: receiver,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// OpenAI API rate limiting
const limiterOpenAI = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
  delayMs: 0, // disable delaying - full speed until the max limit is reached
});

// Google API rate limiting
const limiterGoogle = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  delayMs: 0, // disable delaying - full speed until the max limit is reached
});

app.use('/api/openai', limiterOpenAI);
app.use('/api/google', limiterGoogle);

slackApp.event("app_mention", async ({ event, say }) => {
  try {
    const chatGptResponse = await generateChatgptResponse(event.text);
    await say({ text: chatGptResponse, thread_ts: event.ts });
  } catch (error) {
    console.error("Error generating response:", error);
  }
});

async function generateChatgptResponse(prompt) {
  const chatEndpoint = "https://api.openai.com/v1/engines/davinci-codex/completions";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  };
  const data = {
    prompt: `As an advanced AI assistant, respond to the user: ${prompt}`,
    max_tokens: 100,
    n: 1,
    stop: null,
    temperature: 0.8,
    model: "gpt-4",
  };

  try {
    const response = await axios.post(chatEndpoint, data, { headers });
    const generatedResponses = response.data.choices[0].text.trim();
    return generatedResponses;
  } catch (error) {
    throw error;
  }
}

slackApp.command("/google", async ({ ack, say, command }) => {
  await ack();
  try {
    const googleResponse = await googleSearch(command.text);
    if (googleResponse?.items?.length) {
      const responseText = googleResponse.items
        .map(
          (item, index) =>
            `${index + 1}. <${item.link}|${item.title}> - ${item.snippet}`
        )
        .join("\n");
      await say(responseText);
    } else {
      await say("No results found.");
    }
  } catch (error) {
    console.error("Error searching Google:", error);
  }
});

async function googleSearch(query) {
  const endpoint = "https://www.googleapis.com/customsearch/v1";
  const params = {
    key: process.env.GOOGLE_API_KEY,
    cx: process.env.GOOGLE_CSE_ID,
    q: query,
  };

  try {
    const response = await axios.get(endpoint, { params });
    return response.data;
  } catch (error) {
    throw error;
  }
}

(async () => {
  try {
    await slackApp.start(process.env.PORT || 3000);
    console.log(":zap:️ Assistant is running!");
  } catch (error) {
    console.error("Error starting app:", error);
  }
})();

module.exports = app;
