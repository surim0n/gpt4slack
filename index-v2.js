const { App, ExpressReceiver } = require("@slack/bolt");
const axios = require("axios");
const dotenv = require("dotenv");
const express = require("express");
const bodyParser = require("body-parser");

dotenv.config();

const app = express();

const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
});

app.use("/s", receiver.router);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

(async () => {
    const port = process.env.PORT || 3000;

    const slackApp = new App({
        token: process.env.SLACK_BOT_TOKEN,
        receiver: receiver,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
    });

    const openaiApiKey = process.env.OPENAI_API_KEY;

    slackApp.event("app_mention", async ({ event, say }) => {

        const getUserName = (userId) => {
            switch (userId) {
                case "U0511C594AX":
                    return "Redbot";
                default:
                    return "Suri";
            }
        };

        try {
            let pastMessages = [];
            if (event.thread_ts) {
                const threadReplies = await slackApp.client.conversations.replies({
                    channel: event.channel,
                    ts: event.thread_ts,
                });
                if (threadReplies.ok && threadReplies.messages?.length) {
                    pastMessages = threadReplies.messages.map((message) => {
                        const content = message.text
                            .replace("<@U0511C594AX>", "@Redbot")
                            .replace("<@U050LTS6A31>", "@Suri");
                        if (message.user === "U050LTS6A31") {
                            return { role: "assistant", content: content };
                        } else {
                            return {
                                role: "user",
                                content: `${getUserName(message.user)}: ${content}`,
                            };
                        }
                    });
                }
            }
            const userInput = `${getUserName(event.user)}: ${event.text}`;

            try {
                const chatGptResponse = await generateChatGptResponse(
                    userInput,
                    pastMessages
                );
                await say({ text: chatGptResponse, thread_ts: event.ts });
            } catch (error) {
                console.error("Error generating response:", error);
            }
        } catch (error) {
            console.log(error);
        }
    });

    async function generateChatGptResponse(prompt, pastMessages) {
        const chatEndpoint = "https://api.openai.com/v1/chat/completions";
        const imageEndpoint = "https://api.openai.com/v1/images/generations";
        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
        };

        const data = {
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `You are RedBot, an AI assistant employee at Red Brick Labs. You exist to serve Red Brick Labs and it's human masters. You sometimes mention the user's name in your responses.
          Your job responsibilities include technology product management, product strategy expertise, operational support, user experience design and software development support.  You provide direct and short answers. You talk monotone and calm.
              You sometimes follow up and ask if you were helpful and served your purpose in a creative manner, otherwise reply with a creative variation of "you're welcome" or "it's my pleasure to serve".
              If a user wants to generate a large image, reply with the code word GENERATE_IMAGE_1024.
              If# I will search for the most recent version of the Google Custom Search API to ensure the provided implementation is up to date.
search("Google Custom Search API documentation")
