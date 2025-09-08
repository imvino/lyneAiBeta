import { v4 as uuidv4 } from "uuid";
import { ChatOpenAI } from "@langchain/openai";
import {
  START,
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// ---------- LLM ----------
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Prompt ----------
const promptTemplate = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant. Answer in {language}."],
  ["placeholder", "{messages}"],
]);

// ---------- Graph ----------
const GraphAnnotation = MessagesAnnotation;

const callModel = async (state) => {
  const prompt = await promptTemplate.invoke({
    messages: state.messages,
    language: state.language || "English",
  });
  const response = await llm.invoke(prompt);
  return { messages: [response] };
};

const workflow = new StateGraph(GraphAnnotation)
  .addNode("model", callModel)
  .addEdge(START, "model")
  .addEdge("model", END);

// Keep memory at module scope so it survives across requests in the same process
const memory = new MemorySaver();
const app = workflow.compile({ checkpointer: memory });

// ---------- Helper ----------
function getThreadId(body) {
  return body?.threadId || uuidv4();
}

// ---------- API Handler ----------
export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      hint: "POST { messages: [{role, content}], language?: 'English', threadId?: string }",
    });
  }

  if (req.method === "POST") {
    try {
      const { messages = [], language = "English", threadId } = req.body || {};
      const tid = threadId || getThreadId(req.body);

      // Validate minimal shape
      if (!Array.isArray(messages) || messages.length === 0) {
        return res
          .status(400)
          .json({ error: "Provide messages: [{ role: 'user'|'assistant', content: string }]" });
      }

      const output = await app.invoke(
        { messages, language },
        { configurable: { thread_id: tid } }
      );

      const last = output.messages[output.messages.length - 1];
      return res.status(200).json({
        threadId: tid,
        reply: last?.content ?? "",
        // If you want the full running state/history:
        messages: output.messages,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
