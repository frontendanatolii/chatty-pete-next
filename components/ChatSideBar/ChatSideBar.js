import { faMessage, faPlus, faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link"
import { useEffect, useState } from "react";

export const ChatSideBar = ({ chatId }) => {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    fetch('/api/chat/getChatList', {
      method: 'POST'
    })
      .then((response) => response.json())
      .then(data => setChats(data?.chats || []))
  }, [chatId])

  return (
    <div className="flex flex-col overflow-hidden bg-gray-900 text-white">
      <Link href='/chat' className="side-menu-item bg-emerald-500 hover:bg-emerald-600">
        <FontAwesomeIcon icon={faPlus} /> New chat
      </Link>
      <div className="flex-1 overflow-auto bg-gray-950">
        {chats.map(chat => (
          <Link
            key={chat._id}
            href={`/chat/${chat._id}`}
            className={`side-menu-item ${chatId === chat._id ? 'bg-gray-700 hover:bg-gray-700' : ''}`}
          >
            <FontAwesomeIcon icon={faMessage} className="text-white/50" />
            <span
              title={chat.title}
              className="overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {chat.title}
            </span>
          </Link>
        ))}
      </div>
      <Link href='/api/auth/logout' className="side-menu-item">
        <FontAwesomeIcon icon={faRightFromBracket} /> Logout
      </Link>
    </div>
  )
}