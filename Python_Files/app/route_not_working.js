import { NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import axios from "axios";
import { AzureChatOpenAI } from "@langchain/azure-openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { ConversationBufferMemory } from "langchain/memory";

// ----------------- In-memory store -----------------
const tlofStore = new Map(); // id -> geometry object

// ----------------- Tool: Create TLOF -----------------
async function create_tlof_geometry(data) {
  const id = `TLOF-${Date.now()}`;
  const geometry = {
    id,
    aircraftType: data.aircraftType || "Unknown",
    layerName: "TLOF",
    shapeType: data.shapeType || "Rectangle",
    length: data.length || 30,
    width: data.width || 30,
    diameter: data.diameter || 30,
    ...data,
  };
  tlofStore.set(id, geometry);
  return geometry;
}

// ----------------- Tool: Update TLOF -----------------
async function update_tlof_geometry({ id, key, value }) {
  if (!tlofStore.has(id)) return { error: "Geometry not found" };
  const geom = tlofStore.get(id);
  geom[key] = value;
  tlofStore.set(id, geom);
  return geom;
}

// ----------------- Azure Cognitive Search -----------------
async function performAzureSearch(query) {
  try {
    const response = await axios.post(
      `${process.env.AZURE_SEARCH_SERVICE_ENDPOINT}/indexes/${process.env.AZURE_SEARCH_INDEX_NAME}/docs/search?api-version=2021-04-30-Preview`,
      { search: query, top: 1, select: "content", queryType: "simple" },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.AZURE_SEARCH_ADMIN_KEY,
        },
      }
    );
    return response.data.value.length ? response.data.value[0].content : "";
  } catch (e) {
    console.error("Azure Search failed:", e.message);
    return "";
  }
}

// ----------------- Tool: Query Aviation Knowledge -----------------
async function query_aviation_knowledge(question) {
  // Step 1: Search KB
  const kbContent = await performAzureSearch(question);
  if (kbContent) return `From knowledge base: ${kbContent}`;

  // Step 2: GPT fallback (OpenAI SDK)
  const azureGpt4 = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT, // full URL
    apiVersion: process.env.OPENAI_API_VERSION || "2024-02-15-preview",
  });

  const resp = await azureGpt4.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4, // deployment name
    messages: [
      {
        role: "system",
        content: `You are an aviation design assistant.
If no KB data is found, use ICAO defaults or known aircraft specs.
Never return just a disclaimer.`,
      },
      { role: "user", content: question },
    ],
    max_tokens: 500,
  });

  return resp.choices?.[0]?.message?.content || "No answer found";
}

// ----------------- Memory -----------------
const memory = new ConversationBufferMemory({
  memoryKey: "chat_history",
  returnMessages: true,
});

// ----------------- API Handler -----------------
export async function POST(req) {
  try {
    const body = await req.json();
    const userMessage = body?.messages?.[0]?.content || "";

    // LangChain Azure Chat
    const llm = new AzureChatOpenAI({
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4,
      azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
      azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_RESOURCE_NAME, // just resource name, not full URL
      azureOpenAIApiVersion: process.env.OPENAI_API_VERSION || "2024-02-15-preview",
      temperature: 0,
    });

    const tools = [
      {
        name: "create_tlof_geometry",
        description: "Create a new TLOF geometry with validated parameters",
        func: create_tlof_geometry,
      },
      {
        name: "update_tlof_geometry",
        description: "Update a specific field in an existing TLOF geometry",
        func: update_tlof_geometry,
      },
      {
        name: "query_aviation_knowledge",
        description: "Query aviation knowledge base or GPT for helipad design info",
        func: query_aviation_knowledge,
      },
    ];

    const agent = await initializeAgentExecutorWithOptions(tools, llm, {
      agentType: "chat-conversational-react-description",
      memory,
      verbose: true,
    });

    const result = await agent.call({ input: userMessage });

    return NextResponse.json({
      content: result.output,
      steps: result.intermediateSteps,
      memory: memory.chatHistory,
    });
  } catch (err) {
    console.error("Agent error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
