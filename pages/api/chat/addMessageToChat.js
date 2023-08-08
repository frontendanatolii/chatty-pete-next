import { getSession } from "@auth0/nextjs-auth0";
import clientPromise from "lib/mongodb";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  try {
    const { user } = await getSession(req, res);
    const client = await clientPromise;
    const db = client.db("ChattyPete");

    const { chatId, role, content } = req.body;

    let objectId;

    //validate chatID
    try {
      objectId = new ObjectId(chatId);
    } catch (e) {
      res.status(422).json({
        message: "Invalid chat id",
      });
    }

    // validate content data
    if (!content || typeof content === "string" || (role === 'user' && content.length > 200)) {
      res.status(422).json({
        message:
          "Please, enter valid data. Content is required and must be less than 200 characters",
      });
      return;
    }

    // validate role
    if (role !== "user" || role !== "assistant") {
      res.status(422).json({
        message:
          "role must be either 'assistant' or 'user' ",
      });
      return;
    }

    const chat = await db.collection("chats").findOneAndUpdate(
      {
        _id: objectId,
        userId: user.sub,
      },
      {
        $push: {
          messages: {
            role,
            content,
          },
        },
      },
      {
        returnDocument: "after",
      }
    );

    res.status(200).json({
      chat: {
        ...chat.value,
        _id: chat.value._id.toString(),
      },
    });
  } catch (e) {
    res.status(500).json({ message: "An error to add message to a chat" });
  }
}
