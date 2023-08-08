import { OpenAIEdgeStream } from "openai-edge-stream";

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  try {
    const { chatId: chatIdFromParam, message } = await req.json();

    if (!message || typeof message === "string" || message.length > 200) {
      return new Response(
        {
          message:
            "Please, enter valid data. Message is required and must be less than 200 characters",
        },
        {
          status: 422,
        }
      );
    }

    let chatId = chatIdFromParam;
    let newChatId;
    let chatMessages = [];
    const initialMessage = {
      role: "system",
      content:
        "Your name is Chatty-Pete. An incredibly intelligent and quick-thinking AI, that always replies with an enthusiastic and positive energy. You were created by Anatolii Petras. Your response must be formatted as markdown.",
    };

    if (chatId) {
      const response = await fetch(
        `${req.headers.get("origin")}/api/chat/addMessageToChat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: req.headers.get("cookie"),
          },
          body: JSON.stringify({
            chatId,
            role: "user",
            content: message,
          }),
        }
      );

      const json = await response.json();

      chatMessages = json.chat.messages || [];
    } else {
      const response = await fetch(
        `${req.headers.get("origin")}/api/chat/createNewChat`,
        {
          method: "POST",
          body: JSON.stringify({
            message: message,
          }),
          headers: {
            "Content-Type": "application/json",
            cookie: req.headers.get("cookie"),
          },
        }
      );

      const json = await response.json();

      chatId = json._id;
      newChatId = json._id;
      chatMessages = json.messages || [];
    }

    const messagesToInclude = [];
    chatMessages.reverse();
    let usedTokens = 0;

    for (let chatMessage of chatMessages) {
      const chatMessageTokens = chatMessage.content.length / 4;
      usedTokens += chatMessageTokens;
      if (usedTokens <= 2000) {
        messagesToInclude.push(chatMessage);
      } else {
        break;
      }
    }

    messagesToInclude.reverse();

    const stream = await OpenAIEdgeStream(
      "https://api.openai.com/v1/chat/completions",
      {
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer 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`,
        },
        method: "POST",
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [initialMessage, ...messagesToInclude],
          stream: true,
        }),
      },
      {
        onBeforeStream: ({ emit }) => {
          if (newChatId) {
            emit(newChatId, "newChatId");
          }
        },
        onAfterStream: async ({ fullContent }) => {
          await fetch(
            `${req.headers.get("origin")}/api/chat/addMessageToChat`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                cookie: req.headers.get("cookie"),
              },
              body: JSON.stringify({
                chatId,
                role: "assistant",
                content: fullContent,
              }),
            }
          );
        },
      }
    );

    return new Response(stream);
  } catch (err) {
    return new Response(
      {
        message:
          "An error occurred when send a message",
      },
      {
        status: 500,
      }
    );
  }
}
