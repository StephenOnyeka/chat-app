import React, { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

interface Message {
  user: string;
  text: string;
  time: string;
  to?: string;
  type: "group" | "private";
}

interface ChatHistory {
  type: "group" | "private";
  chatId?: string;
  messages: Message[];
}

function getPrivateChatId(userA: string, userB: string) {
  return [userA, userB].sort().join("::");
}

function App() {
  const [username, setUsername] = useState("");
  const [inputName, setInputName] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<string[]>([]);
  const [status, setStatus] = useState<{
    user: string;
    online: boolean;
  } | null>(null);
  const [activeChat, setActiveChat] = useState<
    { type: "group" } | { type: "private"; user: string }
  >({ type: "group" });
  const [groupMessages, setGroupMessages] = useState<Message[]>([]);
  const [privateMessages, setPrivateMessages] = useState<{
    [chatId: string]: Message[];
  }>({});
  const [unread, setUnread] = useState<{ [chatId: string]: number }>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Join logic
  useEffect(() => {
    if (!username) return;
    socket.connect();
    socket.emit("join", { name: username, id: username });

    socket.on("chat history", (data: ChatHistory) => {
      if (data.type === "group") {
        setGroupMessages(data.messages);
      } else if (data.type === "private" && data.chatId) {
        setPrivateMessages((prev) => ({
          ...prev,
          [data.chatId!]: data.messages,
        }));
      }
    });
    socket.on("message", (msg: Message) => {
      setGroupMessages((prev) => [...prev, msg]);
      if (!(activeChat.type === "group")) {
        setUnread((u) => ({ ...u, group: (u.group || 0) + 1 }));
      }
    });
    socket.on(
      "private message",
      ({ chatId, message }: { chatId: string; message: Message }) => {
        setPrivateMessages((prev) => ({
          ...prev,
          [chatId]: [...(prev[chatId] || []), message],
        }));
        if (
          !(
            activeChat.type === "private" &&
            getPrivateChatId(username, activeChat.user) === chatId
          )
        ) {
          setUnread((u) => ({ ...u, [chatId]: (u[chatId] || 0) + 1 }));
        }
      }
    );
    socket.on("users", (userList: string[]) => {
      setUsers(userList);
    });
    socket.on("status", (stat: { user: string; online: boolean }) => {
      setStatus(stat);
      setTimeout(() => setStatus(null), 2000);
    });
    return () => {
      socket.off("chat history");
      socket.off("message");
      socket.off("private message");
      socket.off("users");
      socket.off("status");
      socket.disconnect();
    };
    // eslint-disable-next-line
  }, [username]);

  // Fetch private chat history when switching
  useEffect(() => {
    if (activeChat.type === "private") {
      const chatId = getPrivateChatId(username, activeChat.user);
      if (!privateMessages[chatId]) {
        socket.emit("get private history", { withUser: activeChat.user });
      }
      setUnread((u) => ({ ...u, [chatId]: 0 }));
    } else if (activeChat.type === "group") {
      setUnread((u) => ({ ...u, group: 0 }));
    }
    // eslint-disable-next-line
  }, [activeChat, username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat, groupMessages, privateMessages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim()) return;
    if (activeChat.type === "group") {
      socket.emit("group message", message);
    } else if (activeChat.type === "private") {
      socket.emit("private message", { to: activeChat.user, text: message });
    }
    setMessage("");
  };

  if (!username) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-gray-100">
        <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md border border-blue-100">
          <h2 className="text-3xl font-extrabold mb-6 text-center text-blue-700 tracking-tight">
            Messenger Login
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputName.trim()) setUsername(inputName.trim());
            }}
            className="flex flex-col gap-6"
          >
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="Your name"
              autoFocus
              className="border-2 border-blue-200 rounded-lg px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold text-lg shadow"
            >
              Join
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Determine messages to show
  let chatTitle = "Group Chat";
  let chatMessages: Message[] = groupMessages;
  if (activeChat.type === "private") {
    chatTitle = `Private Chat with ${activeChat.user}`;
    const chatId = getPrivateChatId(username, activeChat.user);
    chatMessages = privateMessages[chatId] || [];
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-gray-100">
      {/* Left Sidebar: Chat List */}
      <aside className="w-96 bg-white border-r border-blue-100 flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-blue-100">
          <span className="text-2xl font-extrabold text-blue-700 tracking-tight">
            Chats
          </span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <button
            className={`w-full text-left px-6 py-4 hover:bg-blue-50 focus:outline-none transition-all duration-150 ${
              activeChat.type === "group" ? "bg-blue-100 font-bold" : ""
            }`}
            onClick={() => setActiveChat({ type: "group" })}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-extrabold text-xl shadow">
                G
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-lg">Group Chat</span>
                  {unread.group ? (
                    <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 ml-2 font-bold shadow">
                      {unread.group}
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-gray-400">
                  {groupMessages.length > 0
                    ? groupMessages[groupMessages.length - 1].text.slice(0, 32)
                    : "No messages yet"}
                </span>
              </div>
            </div>
          </button>
          {users
            .filter((user) => user !== username)
            .map((user) => {
              const chatId = getPrivateChatId(username, user);
              const lastMsg = (privateMessages[chatId] || []).slice(-1)[0];
              return (
                <button
                  key={user}
                  className={`w-full text-left px-6 py-4 hover:bg-green-50 focus:outline-none transition-all duration-150 ${
                    activeChat.type === "private" && activeChat.user === user
                      ? "bg-green-100 font-bold"
                      : ""
                  }`}
                  onClick={() => setActiveChat({ type: "private", user })}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-extrabold text-xl shadow">
                      {user[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-lg">{user}</span>
                        {unread[chatId] ? (
                          <span className="bg-green-500 text-white text-xs rounded-full px-2 py-0.5 ml-2 font-bold shadow">
                            {unread[chatId]}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs text-gray-400">
                        {lastMsg
                          ? lastMsg.text.slice(0, 32)
                          : "No messages yet"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </aside>

      {/* Middle Panel: Chat Window */}
      <main className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-10 py-6 border-b border-blue-100 bg-white shadow-sm">
          <div className="flex items-center gap-4">
            {activeChat.type === "group" ? (
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-extrabold text-xl shadow">
                G
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-extrabold text-xl shadow">
                {activeChat.user[0].toUpperCase()}
              </div>
            )}
            <span className="text-2xl font-extrabold text-gray-800 tracking-tight">
              {chatTitle}
            </span>
          </div>
          {status && (
            <div
              className={`text-xs px-3 py-1 rounded-lg font-bold shadow ${
                status.online
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {status.user} is {status.online ? "online" : "offline"}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-10 py-6 bg-gradient-to-br from-white to-blue-50 custom-scrollbar">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.user === username ? "justify-end" : "justify-start"
              } mb-4`}
            >
              <div
                className={`max-w-lg px-6 py-4 rounded-3xl shadow-md transition-all duration-150 ${
                  msg.user === username
                    ? "bg-blue-500 text-white rounded-br-lg"
                    : "bg-white text-gray-900 rounded-bl-lg border border-blue-100"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-base">{msg.user}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.time).toLocaleTimeString()}
                  </span>
                </div>
                <span className="break-words text-lg leading-relaxed">
                  {msg.text}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
      </div>
        <form
          className="flex items-center gap-4 px-10 py-6 border-t border-blue-100 bg-white shadow-sm"
          onSubmit={handleSend}
        >
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            autoFocus
            className="flex-1 border-2 border-blue-200 rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg shadow"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleSend(e);
            }}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-8 py-3 rounded-full hover:bg-blue-700 font-bold text-lg shadow transition-all duration-150"
          >
            Send
        </button>
        </form>
      </main>

      {/* Right Panel: User Info (optional, placeholder) */}
      <aside className="hidden xl:block w-96 bg-white border-l border-blue-100 p-10 shadow-xl">
        <div className="text-2xl font-extrabold mb-6 text-blue-700 tracking-tight">
          User Info
        </div>
        <div className="text-gray-600 text-lg">
          Messenger-style right panel (add group members, actions, etc.)
        </div>
      </aside>
      </div>
  );
}

export default App;
