import { NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import axios from "axios";
import { applyRules, createDefaultLayer, multiLayerFallbackParser } from "@/utils/rules";

// --- Azure GPT-4.1-mini (filter) ---
const azureMini = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY1,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT1,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_MINI,
  apiVersion: process.env.OPENAI_API_VERSION || "2024-02-15-preview",
});

// --- Azure GPT-4 (facts) ---
const azureGpt4 = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4,
  apiVersion: process.env.OPENAI_API_VERSION || "2024-02-15-preview",
});

// --- Azure Cognitive Search ---
async function performAzureSearch(query) {
  try {
    const response = await axios.post(
      `${process.env.AZURE_SEARCH_SERVICE_ENDPOINT}/indexes/${process.env.AZURE_SEARCH_INDEX_NAME}/docs/search?api-version=2023-07-01-Preview`,
      { search: query, top: 1, select: "content", queryType: "simple" },
      { headers: { "Content-Type": "application/json", "api-key": process.env.AZURE_SEARCH_ADMIN_KEY } }
    );
    if (response.data.value && response.data.value.length > 0) {
      const result = response.data.value[0];
      return { content: result.content || "", score: result["@search.score"] || 0 };
    }
    return { content: "", score: 0 };
  } catch (e) {
    console.error("❌ Azure Search failed:", e.message);
    return { content: "", score: 0 };
  }
}

// --- Extract JSON from text ---
function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : "{}";
}

// --- Map user message to layer type ---
function mapLayerFromUserMessage(msg) {
  msg = msg.toLowerCase();
  if (msg.includes("landing surface")) return "TLOF";
  if (msg.includes("geometry")) return "FATO";
  if (msg.includes("tlof")) return "TLOF";
  if (msg.includes("fato")) return "FATO";
  if (msg.includes("taxiway")) return "TAXIWAY";
  if (msg.includes("shape")) return "SHAPES";
  return "TLOF"; // default
}

// --- Detect user intent ---
function detectIntent(msg) {
  msg = msg.toLowerCase();
  if (msg.includes("create") || msg.includes("add") || msg.includes("new") || msg.includes("another") || msg.includes("make")) return "create";
  if (msg.includes("update") || msg.includes("change") || msg.includes("modify") || msg.includes("set") || msg.includes("give")) return "update";
  return "unknown";
}

// --- Merge updates with existing JSON ---
function mergeUpdates(existingJson, data, userMessage, intent) {
  const updatedJson = { ...existingJson };
  const possibleLayers = ["FATO", "TLOF", "TAXIWAY", "SHAPES"];

  function normalizeName(name) {
    return (name || "").toLowerCase().replace(/[\s_]+/g, "");
  }

  function getNextLayerName(layerType) {
    const existing = updatedJson[layerType] || [];
    let maxId = 0;
    existing.forEach(item => {
      const match = (item.dimensions?.layerName || "").match(new RegExp(`^${layerType}_(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    });
    return `${layerType}_${(maxId + 1).toString().padStart(3, "0")}`;
  }

  for (const key of possibleLayers) {
    if (!data[key]) continue;
    if (!Array.isArray(updatedJson[key])) updatedJson[key] = [];

    data[key].forEach(updateObj => {
      if (intent === "update") {
        // Update existing layer by name
        const idx = updatedJson[key].findIndex(
          l => normalizeName(l.dimensions?.layerName) === normalizeName(updateObj.dimensions?.layerName)
        );
        if (idx !== -1) {
          updatedJson[key][idx] = {
            ...updatedJson[key][idx],
            dimensions: { ...updatedJson[key][idx].dimensions, ...updateObj.dimensions }
          };
          return;
        }
      }

      // Create new layer if intent is create or no existing layer found
      const newName = getNextLayerName(key);
      updatedJson[key].push({
        position: updateObj.position || [0, 0],
        isVisible: updateObj.isVisible ?? true,
        dimensions: { ...updateObj.dimensions, layerName: newName }
      });
    });
  }

  return updatedJson;
}

// --- API Route Handler ---
export async function POST(req) {
  try {
    const body = await req.json();
    const messages = body.messages || [];
    const userMessage = messages[messages.length - 1]?.content || "";
    const existingJson = body.existingJson || {};

    if (!userMessage) return NextResponse.json({ content: "No user message." }, { status: 400 });

    let rawAnswer = "";
    let source = "";
    let data = {};
    let text = "";

    // --- Step 1: Azure Search ---
    const kbResult = await performAzureSearch(userMessage);
    if (kbResult.content && kbResult.score > 20) {
      rawAnswer = kbResult.content;
      source = "azure-search";
    } else {
      // Step 2: GPT-4 fallback
      try {
        const resp = await azureGpt4.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4,
          messages: [
            { role: "system", content: "You are an aviation design assistant. Provide factual aircraft dimensions and layer suggestions in JSON." },
            { role: "user", content: userMessage }
          ],
          max_tokens: 700,
        });
        rawAnswer = resp.choices?.[0]?.message?.content || "";
        source = "azure-gpt4";
      } catch (err) {
        console.error("❌ GPT-4 failed:", err.message);
        rawAnswer = "{}";
        source = "error";
      }
    }

    // --- Step 3: GPT-4.1-mini filter ---
    try {
      const filterPrompt = `You are a filtering assistant.
### Task
- Take the raw GPT-4 factual answer.
- Keep the natural text explanation exactly (or correct if unsafe).
- Extract structured parameters, extract dimension data from azure search or gpt-4 in 'meters' always.
- Always return ONE valid JSON object with all updated layers inside and do not return multiple JSON blocks.
- If multiple layers are updated, put them inside the correct arrays (e.g., "FATO": [ ... ], "TLOF": [ ... ]).
- ALWAYS RETURN FULL JSON OUTPUT.

Always return JSON output following this schema:
{
  "text": "<short natural explanation>",
  "data": {
    "FATO": [
      {
        "position": "([number, number], Latitude & Longitude in WGS84. Clamp Lat -90..90, Lon -180..180)",
        "isVisible": "(boolean, Default: true)",
        "dimensions": {
          "sides": "(integer, Range: 3-12, Default: 4)",
          "diameter": "(number, Range: 0.1-100, Default: 30)",
          "width": "(number, Range: 0.1-100, Default: 30)",
          "length": "(number, Range: 0.1-100, Default: 30)",
          "thickness": "(number, Range: 0.01-1.0, Default: 0.5)",
          "rotation": "(number, Range: 0-360, Default: 0)",
          "transparency": "(number, Range: 0.0-1.0, Default: 1.0)",
          "baseHeight": "(number, Range: 0-10, Default: 0)",
          "layerName": "(string, Must be unique per session. Default: 'FATO_Unknown')",
          "textureScaleU": "(number, Range: 0.1-10, Default: 1)",
          "textureScaleV": "(number, Range: 0.1-10, Default: 1)",
          "lightColor": "(string, Options: 'white', 'yellow', 'red', 'blue'. Default: 'white')",
          "lightScale": "(number, Range: 0.1-5, Default: 1)",
          "lightDistance": "(number, Range: 0.1-10, Default: 1)",
          "lightRadius": "(number, Range: 0.1-5, Default: 0.3)",
          "lightHeight": "(number, Range: 0.1-5, Default: 0.2)"
        }
      }
    ]
  },
    "TLOF": [
      {
        "position": "([number, number], Latitude & Longitude in WGS84. Clamp Lat -90..90, Lon -180..180)",
        "isVisible": "(boolean, Default: true)",
        "dimensions": {
          "sides": "(integer, Range: 3-12, Default: 4)",
          "diameter": "(number, Range: 0.1-100, Default: 30)",
          "width": "(number, Range: 0.1-100, Default: 30)",
          "length": "(number, Range: 0.1-100, Default: 30)",
          "thickness": "(number, Range: 0.01-1.0, Default: 0.5)",
          "rotation": "(number, Range: 0-360, Default: 0)",
          "transparency": "(number, Range: 0.0-1.0, Default: 1.0)",
          "baseHeight": "(number, Range: 0-10, Default: 0)",
          "textureScaleU": "(number, Range: 0.1-10, Default: 1)",
          "textureScaleV": "(number, Range: 0.1-10, Default: 1)",
          "layerName": "(string, Must be unique per session. Default: 'TLOF_Unknown')",
          "markingType": "(string, Options: 'solid', 'dashed'. Default: 'dashed')",
          "markingColor": "(string, Options: 'white', 'yellow', 'red', 'blue'. Default: 'white')",
          "markingThickness": "(number, Range: 0.2-1.0, Default: 0.5)",
          "dashDistance": "(number, Range: 0.5-3.0, Default: 1)",
          "dashLength": "(number, Range: 0.5-3.0, Default: 1)",
          "landingMarker": "(string, Single char: 'H' or 'V'. Default: 'H')",
          "markerScale": "(number, Range: 0.1-20, Default: 5)",
          "markerThickness": "(number, Range: 0.2-1.0, Default: 0.5)",
          "letterThickness": "(number, Range: 0.2-1.0, Default: 0.5)",
          "markerRotation": "(number, Range: 0-360, Default: 0)",
          "markerColor": "(string, Options: 'white', 'yellow', 'red', 'blue'. Default: 'blue')",
          "tdpcType": "(string, Options: 'Circle', 'Cross', 'Square'. Default: 'Circle')",
          "tdpcScale": "(number, Range: 0.1-20, Default: 5)",
          "tdpcThickness": "(number, Range: 0.01-1.0, Default: 0.5)",
          "tdpcExtrusion": "(number, Range: 0.0-1.0, Default: 0.02)",
          "tdpcRotation": "(number, Range: 0-360, Default: 0)",
          "tdpcColor": "(string, Options: 'white', 'yellow', 'red', 'blue'. Default: 'white')",
          "lightColor": "(string, Options: 'white', 'yellow', 'red', 'blue'. Default: 'white')",
          "lightScale": "(number, Range: 0.1-5, Default: 1)",
          "lightDistance": "(number, Range: 0.1-10, Default: 1)",
          "lightRadius": "(number, Range: 0.1-5, Default: 0.3)",
          "lightHeight": "(number, Range: 0.1-5, Default: 0.2)",
          "safetyAreaType": "(string, Options: 'multiplier', 'offset'. Default: 'multiplier')",
          "offsetDistance": "(number, Range: 0.1-50, Default: 3)",
          "dValue": "(number, Range: 1-100. Default: 10)",
          "multiplier": "(number, Range: 0.1-10, Default: 1.5)",
          "curveAngle": "(number, Range: 0-90, Default: 45)",
          "safetyNetHeight": "(number, Range: 0.1-50, Default: 15)",
          "safetyNetTransparency": "(number, Range: 0.0-1.0, Default: 0.5)",
          "safetyNetScaleU": "(number, Range: 0.1-10, Default: 1)",
          "safetyNetScaleV": "(number, Range: 0.1-10, Default: 1)",
          "safetyNetColor": "(string, Options: 'white', 'yellow', 'red', 'blue'. Default: 'white')"                    
        }
      }
    ]
  }

RULES:
- Aircraft dimensions must remain within published ranges.
- JSON should always reflect the applied changes, not just the explanation text.
- Return the response in JSON format along with a text defining the reason if user suggests invalid values:
  - In "text", explain the corrected values only in short words.
  - In "data", set corrected safe values.
- When the user requests **new layers**, create full valid JSON with new layer names.
- When the user requests **updates**, change only the required fields in the particular layerName.
- If the user says "landing surface", always map it to **TLOF** only & if "geometry", always map it to **FATO** only.
`;
      const filtered = await azureMini.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_MINI,
        messages: [
          { role: "system", content: filterPrompt },
          { role: "user", content: `User asked: ${userMessage}\nExisting JSON: ${JSON.stringify(existingJson)}\nRaw GPT-4 answer: ${rawAnswer}` },
        ],
        max_tokens: 13107,
        temperature: 0.3,
      });

      const content = filtered.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(extractJson(content));
      text = parsed.text || rawAnswer;
      data = parsed.data || {};
      
      // Fallback if filter returned empty
      if (!data || Object.keys(data).length === 0) {
        console.warn("⚠️ Filter returned empty, applying fallback parser");
        data = multiLayerFallbackParser(existingJson, userMessage);
        text = "Values applied using dynamic fallback parser from user message.";
      }

    } catch (err) {
      console.warn("⚠️ Filtering failed, applying fallback parser");
      data = multiLayerFallbackParser(existingJson, userMessage);
      text = "Values applied using dynamic fallback parser from user message.";
    }

    // --- Step 4: Merge AI updates into existing JSON safely ---
    const intent = detectIntent(userMessage);
    const updatedJson = mergeUpdates(existingJson, data, userMessage, intent);
    
    // --- Final output ---
    console.log("🟢 User asked:", userMessage);
    console.log("📌 Answer source:", source);
    console.log("📝 Text response:", text);
    return NextResponse.json({
      source,
      rawAnswer,
      text,
      data,
      updatedJson,
      content: text,
    });

  } catch (err) {
    console.error("Server error:", err.message);
    return NextResponse.json({ content: "Server error" }, { status: 500 });
  }
}