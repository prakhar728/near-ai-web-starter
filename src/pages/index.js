import { useState, useEffect, useRef } from "react";
import { useWalletSelector } from "@near-wallet-selector/react-hook";

import styles from "@/styles/app.module.css";
import { createThread, fetchThreadState, runAgent } from "@/lib/near-ai-api";

export default function AgentChat() {
  const { signedAccountId, signMessage } = useWalletSelector();

  const [agentId, setAgentId] = useState("");
  const [threadId, setThreadId] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nearSignatureAuth, setNearSignatureAuth] = useState(null);

  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Authenticate using signMessage
  useEffect(() => {
    const authenticate = async () => {
      if (!signedAccountId || !signMessage) return;

      // Check local storage first
      const stored = localStorage.getItem("NearAIAuthObject");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.account_id === signedAccountId) {
            setNearSignatureAuth(parsed);
            return;
          }
        } catch (err) {
          console.error("Stored auth parsing error:", err);
        }
      }

      try {
        const nonce = new String(Date.now());
        const nonceBuffer = Buffer.from(
          new TextEncoder().encode(nonce.padStart(32, "0")),
        );

        const message = "Login to NEAR AI";
        const recipient = "ai.near"; // use actual recipient used by your backend
        const callbackUrl = location.href;

        const result = await signMessage({
          message,
          recipient,
          nonce: nonceBuffer
        });

        const auth = {
          message,
          nonce: nonce,
          recipient: recipient,
          callback_url: callbackUrl,
          signature: result.signature,
          account_id: result.accountId,
          public_key: result.publicKey,
        };

        setNearSignatureAuth(auth);
        localStorage.setItem("NearAIAuthObject", JSON.stringify(auth));
      } catch (err) {
        console.error("Error signing in:", err);
        setError("Authentication failed.");
      }
    };

    authenticate();
  }, [signedAccountId, signMessage]);

  const handleStartChat = async (e) => {
    e.preventDefault();
    if (!agentId.trim()) {
      setError("Please enter an Agent ID");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const newThread = await createThread(nearSignatureAuth);
      if (newThread?.id) {
        setThreadId(newThread.id);
        setMessages([]);
      } else {
        setError("Failed to create thread");
      }
    } catch (err) {
      console.error(err);
      setError("Error starting chat");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !threadId || !agentId) return;

    const userMsg = {
      id: Date.now().toString(),
      role: "user",
      content: [{ type: "text", text: { value: message } }],
      created_at: Date.now(),
    };

    try {
      setLoading(true);
      setMessages((prev) => [...prev, userMsg]);

      await runAgent(nearSignatureAuth, agentId, threadId, message);
      const updatedThread = await fetchThreadState(nearSignatureAuth, threadId);

      if (updatedThread?.data) {
        setMessages((prevMessages) => [
          ...prevMessages,
          ...updatedThread.data
            .filter(
              (msg) =>
                (msg.role === "assistant" && msg.metadata === null) || msg.role === "user"
            )
            .map((msg) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              created_at: msg.created_at,
            })),
        ]);

      }

      setMessage("");
    } catch (err) {
      console.error(err);
      setError("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const formatMessageContent = (content) =>
    Array.isArray(content)
      ? content.map((item, index) =>
        item.type === "text" ? <p key={index}>{item.text?.value}</p> : null
      )
      : "";

  return (
    <main className={styles.main}>
      <div className={styles.description}>
        <h1>Agent Chat</h1>
        <p>Interact with AI agents on NEAR</p>
      </div>

      <div className={styles.container}>
        {!threadId ? (
          <form onSubmit={handleStartChat} className={styles.agentForm}>
            <div className={styles.formGroup}>
              <label htmlFor="agentId" className={styles.label}>
                Enter Agent ID
              </label>
              <input
                type="text"
                id="agentId"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="e.g., ai-creator.near/BlackJack_Dealer/0.0.2"
                className={styles.input}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={styles.startButton}
            >
              {loading ? "Creating Thread..." : "Start Chat"}
            </button>
          </form>
        ) : (
          <>
            <div className={styles.chatHeader}>
              <h2>Chatting with: {agentId}</h2>
              <button
                onClick={() => setThreadId(null)}
                className={styles.newChatButton}
              >
                Start New Chat
              </button>
            </div>

            <div className={styles.messagesArea}>
              {messages.length === 0 ? (
                <p className={styles.emptyMessages}>
                  Send a message to start the conversation
                </p>
              ) : (
                [...messages].map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.message} ${msg.role === "user"
                      ? styles.userMessage
                      : msg.role === "assistant"
                        ? styles.assistantMessage
                        : styles.systemMessage
                      }`}
                  >
                    <div className={styles.messageSender}>
                      {msg.role === "user"
                        ? "You"
                        : msg.role === "assistant"
                          ? "Agent"
                          : "System"}
                    </div>
                    <div className={styles.messageContent}>
                      {formatMessageContent(msg.content)}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className={styles.inputForm}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className={styles.textarea}
                disabled={loading}
                rows="2"
              />
              <button
                type="submit"
                disabled={loading || !message.trim()}
                className={styles.sendButton}
              >
                {loading ? "Sending..." : "Send"}
              </button>
            </form>
          </>
        )}
        {error && <div className={styles.error}>{error}</div>}
      </div>
    </main>
  );
}
