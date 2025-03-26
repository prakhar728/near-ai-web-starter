const BASE_URL = "https://api.near.ai";

/**
 * @typedef {Object} NearAuthData
 * @property {any} message
 * @property {String} nonce
 * @property {string} recipient
 * @property {string} callback_url
 * @property {string} signature
 * @property {string} account_id
 * @property {string} public_key
 */

/**
 * Creates a new thread
 * @param {NearAuthData|null} auth - Authentication data
 * @returns {Promise<Object>} The newly created thread
 */
export const createThread = async (auth) => {
  const URL = `${BASE_URL}/v1/threads`;

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${JSON.stringify(auth)}`,
    "Content-Type": "application/json", // Specify content type
  };

  const body = {
    messages: [
      {
        content: "string",
        role: "user",
        metadata: {},
      },
    ],
  };

  const newThread = await (
    await fetch(URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
  ).json();

  return newThread;
};

/**
 * Runs an agent on a thread with a message
 * @param {NearAuthData} auth - Authentication data
 * @param {string} agent - The agent ID
 * @param {string} thread - The thread ID
 * @param {string} message - The message to send
 * @returns {Promise<Object>} The result of running the agent
 */
export const runAgent = async (auth, agent, thread, message) => {
  const URL = `${BASE_URL}/v1/agent/runs`;
  
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${JSON.stringify(auth)}`,
    "Content-Type": "application/json", // Specify content type
  };

  const body = {
    agent_id: agent,
    thread_id: thread,
    new_message: message,
    max_iterations: 1,
    record_run: true,
    tool_resources: {},
    user_env_vars: {},
  };

  let agentThread;

  try {
    agentThread = await fetch(URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.log(error);
  }

  return (await agentThread.json());
};

/**
 * Fetches the current state of a thread
 * @param {NearAuthData} auth - Authentication data
 * @param {string} thread - The thread ID
 * @returns {Promise<Object>} The messages in the thread
 */
export const fetchThreadState = async (auth, thread) => {
  const URL = `${BASE_URL}/v1/threads/${thread}/messages?order=desc`;
  
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${JSON.stringify(auth)}`,
    "Content-Type": "application/json", // Specify content type
  };

  let messages;

  try {
    messages = await fetch(URL, {
      method: "GET",
      headers,
    });
  } catch (error) {
    console.log(error);
  }

  return (await messages.json());
};