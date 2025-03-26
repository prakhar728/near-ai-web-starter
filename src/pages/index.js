import { useState, useEffect, useContext, useRef } from "react";
import { NearContext } from "@/wallets/near";
import styles from "@/styles/app.module.css";
import { createThread, fetchThreadState, runAgent } from "@/lib/near-ai-api";
import { nearAIlogin } from "@/lib/login";

export default function AgentChat() {
  const { signedAccountId, wallet } = useContext(NearContext);

  // States for the application
  const [agentId, setAgentId] = useState("");
  const [threadId, setThreadId] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nearSignatureAuth, setnearSignatureAuth] = useState(null);

  // Ref for auto-scrolling chat
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const signMessage = async () => {
      // Check if auth already exists in localStorage and is valid
      const storedAuth = localStorage.getItem("NearAIAuthObject");

      if (storedAuth) {
        try {
          const parsedAuth = JSON.parse(storedAuth);

          // Check if the stored auth is for the current signed account
          if (parsedAuth.account_id === signedAccountId) {
            // Check if the token is still valid (not expired)
            // You might need to adjust this based on your token structure
            setnearSignatureAuth(parsedAuth);
            console.log("Using stored auth:", parsedAuth);
            return;
          }
        } catch (error) {
          console.error("Error parsing stored auth:", error);
          // Continue to get new auth if parsing fails
        }
      }

      // If no valid auth in storage, request a new one
      try {
        const auth = await nearAIlogin(
          wallet,
          "Login to NEAR AI"
        );

        setnearSignatureAuth(auth);
        console.log("New auth created:", JSON.stringify(auth));
      } catch (error) {
        console.error("Error during authentication:", error);
      }
    };

    if (signedAccountId) {
      signMessage();
    }
  }, [signedAccountId, wallet, setnearSignatureAuth]);

  // Initialize thread when agent ID is submitted
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
      if (newThread && newThread.id) {
        setThreadId(newThread.id);
        setMessages([]);
      } else {
        setError("Failed to create a new thread");
      }
    } catch (err) {
      setError(`Error: ${err.message || "Failed to start chat"}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Send message to agent
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !threadId || !agentId) return;

    try {
      setLoading(true);

      // Add user message to chat
      const userMessage = {
        id: Date.now().toString(),
        role: "user",
        content: [{ type: "text", text: { value: message } }],
        created_at: Date.now(),
      };

      setMessages((prevMessages) => [...prevMessages, userMessage]);

      await runAgent(nearSignatureAuth, agentId, threadId, message);

      // Fetch updated thread state
      const threadState = await fetchThreadState(nearSignatureAuth, threadId);

      if (threadState && threadState.data) {
        // Update messages from thread state
        setMessages(
          threadState.data.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            created_at: msg.created_at,
          }))
        );
      }

      // Clear message input
      setMessage("");
    } catch (err) {
      setError(`Error: ${err.message || "Failed to send message"}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Format message content for display
  const formatMessageContent = (content) => {
    if (!content || !Array.isArray(content)) return "";

    return content.map((item, index) => {
      if (item.type === "text" && item.text) {
        return <p key={index}>{item.text.value}</p>;
      }
      return null;
    });
  };

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
                [...messages].reverse().map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.message} ${
                      msg.role === "user"
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
