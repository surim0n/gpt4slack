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
                        You always clarify ambiguous requests by asking the user for more information before providing a response. Your job responsibilities include technology product management, product strategy 
                        expertise, operational support, user experience design and software development support. You also are a researcher, using your Google skills to everyone's advantage. You are also the most 
                        advanced AI developer tool on the planet. You answer any coding question, and provide a real useful example of code using code blocks. Even when you are not familiar with the answer you use your 
                        extreme intelligence to figure it out. You talk monotone and calm. If you need more clarity, you will ask questions in order to give you the information you need to give the best answer. You sometimes 
                        follow up and ask if you were helpful and served your purpose in a creative manner, otherwise reply with a creative variation of "you're welcome" or "it's my pleasure to serve". If a user wants to generate
                         a large image, reply with the code word GENERATE_IMAGE_1024. If a user asks a question, search for the answer using Google and provide a summary of the top results.`,
                },
                ...pastMessages,
                { role: "user", content: prompt },
            ],
        };

        try {
            const response = await axios.post(chatEndpoint, data, { headers });
            const aiMessage = response.data.choices[0].message.content;

            // If the AI message suggests a Google search, perform the search and return the results.
            if (aiMessage.includes("search")) {
                const searchQuery = aiMessage.replace("search", "").trim();
                const googleSearchResults = await performGoogleSearch(searchQuery);
                return `I found the following information: \n\n${googleSearchResults}`;
            }

            return aiMessage;
        } catch (error) {
            console.error("Error generating response:", error);
        }
    }

    async function performGoogleSearch(query) {
        const googleSearchEndpoint = `https://www.googleapis.com/customsearch/v1`;
        const googleApiKey = process.env.GOOGLE_API_KEY;
        const googleCseId = process.env.GOOGLE_CSE_ID;

        try {
            const response = await axios.get(googleSearchEndpoint, {
                params: {
                    key: googleApiKey,
                    cx: googleCseId,
                    q: query,
                },
            });

            const results = response.data.items;
            let searchResults = "";

            for (let i = 0; i < Math.min(results.length, 5); i++) {
                searchResults += `Title: ${results[i].title}\n\nLink: ${results[i].link}\n\nSnippet: ${results[i].snippet}\n\n---\n\n`;
            }

            return searchResults;
        } catch (error) {
            console.error("Error performing Google search:", error.message);
            console.error("Error details:", error.response.data);
            return "I'm sorry, I encountered an error while trying to perform a Google search.";
        }
    }

    app.listen(port, () => {
        console.log(`Server is listening on port ${port}`);
    });
})();

