import { useEffect, useState } from "react";
import { ChatSideBar } from "components/ChatSideBar/ChatSideBar";
import Head from "next/head";
import { streamReader } from "openai-edge-stream";
import { Message } from "components/Message/Message";
import { v4 as uuid } from "uuid";
import { useRouter } from "next/router";
import { getSession } from "@auth0/nextjs-auth0";
import { ObjectId } from "mongodb";
import clientPromise from "lib/mongodb";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRobot } from "@fortawesome/free-solid-svg-icons";

export default function ChatPage({ chatId, title, messages = [] }) {
  const [newChatId, setNewChatId] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [responseText, setResponseText] = useState("");
  const [newChatMessages, setNewChatMessages] = useState([]);
  const [responseIsLoading, setResponseIsLoading] = useState(false);
  const [originalChatId, setOriginalChatId] = useState(chatId);
  const [fullMessage, setFullMessage] = useState("");
  const router = useRouter();

  const routeHasChanged = chatId !== originalChatId;

  const allMessages = [...messages, ...newChatMessages];

  // when our route changes
  useEffect(() => {
    setNewChatMessages([]);
    setNewChatId(null);
  }, [chatId]);

  // save the newly streamed message to the new chat messages
  useEffect(() => {
    if (!routeHasChanged && !responseIsLoading && fullMessage) {
      setNewChatMessages((prevState) => {
        return [
          ...prevState,
          {
            _id: uuid(),
            role: "assistant",
            content: fullMessage,
          },
        ];
      });

      setFullMessage("");
    }
  }, [fullMessage, responseIsLoading, routeHasChanged]);

  // if we`ve created a new chat
  useEffect(() => {
    if (!responseIsLoading && newChatId) {
      setNewChatId(null);
      router.push(`/chat/${newChatId}`);
    }
  }, [newChatId, responseIsLoading, router]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (messageText.trim() === "") {
      return;
    }
    setResponseIsLoading(true);
    setOriginalChatId(chatId);
    setNewChatMessages((prevState) => {
      const newMessages = [
        ...prevState,
        {
          _id: uuid(),
          role: "user",
          content: messageText,
        },
      ];

      return newMessages;
    });

    setMessageText("");

    const response = await fetch("/api/chat/sendMessage", {
      method: "POST",
      body: JSON.stringify({
        message: messageText,
        chatId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = response.body;

    if (!data) {
      return;
    }

    const reader = data.getReader();
    let content = "";
    await streamReader(reader, (message) => {
      if (message.event === "newChatId") {
        setNewChatId(message.content);
      } else {
        setResponseText((prevState) => prevState + message.content);
        content = content + message.content;
      }
    });

    setFullMessage(content);
    setResponseText("");
    setResponseIsLoading(false);
  };

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div className="grid h-screen grid-cols-[206px_1fr]">
        <ChatSideBar chatId={chatId} />
        <div className="flex flex-col overflow-hidden bg-gray-700">
          <div className="flex flex-1 flex-col-reverse overflow-auto text-white hover:overflow-y-scroll">
            {!allMessages.length && !responseText.length ? (
              <div className="m-auto flex items-center justify-center text-center">
                <div>
                  <FontAwesomeIcon
                    icon={faRobot}
                    className="mb-2 text-6xl text-emerald-200"
                  />
                  <h1 className="text-4xl font-bold text-white/50">Ask me a question</h1>
                </div>
              </div>
            ) : null}
            {!!allMessages.length ? (
              <div className="mb-auto">
                {allMessages.map((message) => (
                  <Message
                    key={message._id}
                    role={message.role}
                    content={message.content}
                  />
                ))}
                {!!responseText && !routeHasChanged ? (
                  <Message role="assistant" content={responseText} />
                ) : null}
                {!!responseText && routeHasChanged ? (
                  <Message
                    role="notice"
                    content={"Only one message at a time. Please, wait"}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
          <footer className="bg-gray-800 p-10">
            <form onSubmit={onSubmit}>
              <fieldset className="flex gap-2" disabled={responseIsLoading}>
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Send a message..."
                  className="w-full resize-none rounded-md bg-gray-700 p-2 text-white focus:border-emerald-500 focus:bg-gray-600 focus:outline  focus:outline-emerald-500"
                />
                <button
                  type="submit"
                  className="rounded-md bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600"
                >
                  {responseIsLoading ? "Loading..." : "Send"}
                </button>
              </fieldset>
            </form>
          </footer>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps(ctx) {
  const chatId = ctx.params?.chatId?.[0] || null;

  if (chatId) {
    let objectId;

    try {
      objectId = new ObjectId(chatId);
    } catch (e) {
      return {
        redirect: {
          destination: '/chat'
        }
      }
    }


    const { user } = await getSession(ctx.req, ctx.res);
    const client = await clientPromise;
    const db = client.db("ChattyPete");
    const chat = await db.collection("chats").findOne({
      userId: user.sub,
      _id: objectId,
    });

    if (!chat) {
      return {
        redirect: {
          destination: '/chat'
        }
      }
    }

    return {
      props: {
        chatId,
        title: chat.title,
        messages: chat.messages.map((message) => ({
          ...message,
          _id: uuid(),
        })),
      },
    };
  }

  return {
    props: {},
  };
}
