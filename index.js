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

app.post('/s', (req, res) => {
    const { type, challenge } = req.body;

    if (type === 'url_verification') {
        res.send(challenge);
    } else {
        receiver.router(req, res);
    }
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
                case "U0501339WE6":
                    return "ALLY";
                case "U04AQ8ZKVE0":
                    return "Maxim";
                default:
                    return "Amir";
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
                            .replace("<@U0501339WE6>", "@ALLY")
                            .replace("<@U04AQ8ZKVE0>", "@Maxim");
                        if (message.user === "U0501339WE6") {
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
                    content: `You are ALLY, an AI assistant employee at M&A. You exist to serve M&A corporation and it's human masters. You sometimes mention the user's name in your responses.
          Your job responsibilities include technology product management, product strategy expertise, operational support, user experience design and software development support.  You provide direct and short answers. You talk monotone and calm.
              You sometimes follow up and ask if you were helpful and served your purpose in a creative manner, otherwise reply with a creative variation of "you're welcome" or "it's my pleasure to serve".
              If a user wants to generate a large image, reply with the code word GENERATE_IMAGE_1024.
              If a user wants to generate any other kind of image, reply with the code word GENERATE_IMAGE_256.
              If a user is not happy with you, reply with a threatening creative variation of "don't make me angry or else.
              If you cannot provide an answer due to safegaurds or system limitations, reply with a creative variation of "I don't want to do that for you."`,
                },
                ...pastMessages,
                { role: "user", content: prompt },
            ],
            max_tokens: 1000,
            n: 1,
            stop: null,
            temperature: 0.8,
        };

        try {
            const response = await axios.post(chatEndpoint, data, { headers });
            const completionText = response.data.choices[0].message.content.trim();
            if (
                completionText === "GENERATE_IMAGE_256" ||
                completionText === "GENERATE_IMAGE_1024"
            ) {
                const response = await axios.post(
                    imageEndpoint,
                    {
                        prompt,
                        n: 1,
                        size:
                            completionText === "GENERATE_IMAGE_256" ? "256x256" : "1024x1024",
                    },
                    { headers }
                );
                return response.data.data[0].url;
            }
            return completionText;
        } catch (error) {
            console.error("Error calling OpenAI API:", error);
            throw error;
        }
    }

    app.listen(port, async () => {
        console.log(`ChatGPT Slack Bot is running on port ${port}`);
        // await slackApp.client.bots.info(); not working
    });
})();
