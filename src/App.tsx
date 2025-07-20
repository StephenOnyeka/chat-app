import React, { useEffect, useRef, useState } from "react";
import "./App.css";
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
      <div className="join-container">
        <h2>Enter your name to join the chat</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inputName.trim()) setUsername(inputName.trim());
          }}
        >
          <input
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
          <button type="submit">Join</button>
        </form>
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
    <div className="chat-app">
      <div className="sidebar">
        <div className="sidebar-section">
          <button
            className={activeChat.type === "group" ? "active-tab" : ""}
            onClick={() => setActiveChat({ type: "group" })}
          >
            Group Chat{" "}
            {unread.group ? (
              <span className="unread">{unread.group}</span>
            ) : null}
          </button>
        </div>
        <div className="sidebar-section">
          <h3>Online Users</h3>
          <ul>
            {users
              .filter((user) => user !== username)
              .map((user) => {
                const chatId = getPrivateChatId(username, user);
                return (
                  <li key={user}>
                    <button
                      className={
                        activeChat.type === "private" &&
                        activeChat.user === user
                          ? "active-tab"
                          : ""
                      }
                      onClick={() => setActiveChat({ type: "private", user })}
                    >
                      {user}
                      {unread[chatId] ? (
                        <span className="unread">{unread[chatId]}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>
      <div className="chat-container">
        <div className="chat-header">
          <h2>{chatTitle}</h2>
          {status && (
            <div className={`status ${status.online ? "online" : "offline"}`}>
              {status.user} is {status.online ? "online" : "offline"}
            </div>
          )}
        </div>
        <div className="chat-window">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-message ${
                msg.user === username ? "sent" : "received"
              }`}
            >
              <span className="msg-user">{msg.user}:</span>
              <span className="msg-text">{msg.text}</span>
              <span className="msg-time">
                {new Date(msg.time).toLocaleTimeString()}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form className="chat-input" onSubmit={handleSend}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleSend(e);
            }}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export default App;
