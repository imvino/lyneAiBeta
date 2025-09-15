import { NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import axios from "axios";
import fs from "fs";
import path from "path";

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
      `${process.env.AZURE_SEARCH_SERVICE_ENDPOINT}/indexes/${process.env.AZURE_SEARCH_INDEX_NAME}/docs/search?api-version=2023-07-01-Preview `,
      { search: query, top: 1, select: "content", queryType: "simple" },
      { headers: { "Content-Type": "application/json", "api-key": process.env.AZURE_SEARCH_ADMIN_KEY } }
    );

    if (response.data.value && response.data.value.length > 0) {
      const result = response.data.value[0];
      return {
        content: result.content || "",
        score: result["@search.score"] || 0,
      };
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

// --- Map user message to layer types (plural) ---
function mapLayersFromUserMessage(msg) {
  const text = msg.toLowerCase().replace(/[\s_]+/g, " "); // normalize spaces & underscores
  const layers = [];

  // --- Synonyms dictionary for layer mapping ---
const synonyms = {
  TLOF: [
    "tlof", "landing surface", "helipad", "landing area"
  ],
  FATO: [
    "fato", "geometry", "final approach", "approach area", "approach surface"
  ],
  TAXIWAY: [
    "taxiway", "taxi route", "taxi path"
  ],
  SHAPE: [
    "shape", "shapes"
  ],
  MODEL: [
    "model library", "model"
  ],
  VOLUME: [
    "ofv", "volume", "cylinder volume", "rectilinear volume"
  ],
  FLIGHTPATH: [
    "flightpath", "flight path"
  ],
  FLIGHTPATH_VFR: [
    "ols", "flightpath vfr"
  ]
};

for (const [layerType, keywords] of Object.entries(synonyms)) {
    for (const kw of keywords) {
      // match whole word or phrase
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(text)) {
        layers.push(layerType);
        break; // stop checking more synonyms for this layer
      }
    }
  }

  return [...new Set(layers)]; // remove duplicates
}

// --- Detect user intent ---
function detectIntent(msg) {
  msg = msg.toLowerCase();
  if (msg.includes("create") || msg.includes("add") || msg.includes("new") || msg.includes("another") || msg.includes("make")) return "create";
  if (msg.includes("update") || msg.includes("change") || msg.includes("modify") || msg.includes("set") || msg.includes("give")) return "update";
  return "unknown";
}

// --- Templates directory ---
const TEMPLATES_DIR = path.join(process.cwd(), "templates");

// --- Helper: load template by layer type ---
function getTemplateByName(layerType) {
  const filePath = path.join(TEMPLATES_DIR, `${layerType.toLowerCase()}.json`);

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return { content: JSON.parse(content) };
    } catch (err) {
      console.error(`❌ Failed to read template for ${layerType}:`, err.message);
      return null;
    }
  } else {
    console.warn(`⚠️ Template file not found for ${layerType} at ${filePath}`);
    return null;
  }
}

// --- Parse aircraft name from user message ---
function parseAircraftName(text) {
  const match = text.match(/(?:for|of)\s+([A-Za-z0-9\- ]{2,50})/i);
  if (!match) return "001"; // fallback
  const name = match[1].trim().replace(/\s+/g, "").replace(/[^A-Za-z0-9]/g, "");
  return name || "001"; // fallback if empty after cleanup
}

// --- Parse layer type from user message ---
function parseLayerType(text) {
  // First check explicit "use <TLOF|FATO|...>"
  const explicit = text.match(/\buse\s+(TLOF|FATO|TAXIWAY|SHAPES)\b/i);
  if (explicit) return explicit[1].toUpperCase();
  const match = text.match(/\b(TLOF|FATO|TAXIWAY|SHAPES)\b/i);
  return match ? match[1].toUpperCase() : "TLOF";
}

// --- Create default layer if filter fails ---
function createDefaultLayer(userMessage, forcedLayerType) {
  const aircraftName = parseAircraftName(userMessage);
  const layerType = forcedLayerType || parseLayerType(userMessage);

  let layer = {
    position: [0, 0],
    isVisible: true,
    dimensions: { layerName: `${layerType}_${aircraftName}` }
  };

  // Layer-specific defaults (unchanged)
  switch (layerType) {
    case "TLOF":
      layer.dimensions = {
        ...layer.dimensions,
        sides: 4,
        diameter: 30,
        width: 30,
        length: 30,
        thickness: 0.5,
        rotation: 0,
        transparency: 1,
        baseHeight: 0,
        textureScaleU: 1,
        textureScaleV: 1,
        markingType: "dashed",
        markingColor: "white",
        markingThickness: 0.5,
        dashDistance: 1,
        dashLength: 1,
        landingMarker: "H",
        markerScale: 5,
        markerThickness: 0.5,
        letterThickness: 0.5,
        markerRotation: 0,
        markerColor: "blue",
        tdpcType: "Circle",
        tdpcScale: 5,
        tdpcThickness: 0.5,
        tdpcExtrusion: 0.02,
        tdpcRotation: 0,
        tdpcColor: "white",
        lightColor: "white",
        lightScale: 1,
        lightDistance: 1,
        lightRadius: 0.3,
        lightHeight: 0.2,
        safetyAreaType: "multiplier",
        offsetDistance: 3,
        dValue: 10,
        multiplier: 1.5,
        curveAngle: 45,
        safetyNetHeight: 15,
        safetyNetTransparency: 0.5,
        safetyNetScaleU: 1,
        safetyNetScaleV: 1,
        safetyNetColor: "white"
      };
      break;

    case "FATO":
      layer.dimensions = {
        ...layer.dimensions,
        sides: 6,
        diameter: 30,
        width: 30,
        length: 30,
        thickness: 0.5,
        rotation: 0,
        transparency: 1,
        baseHeight: 0,
        textureScaleU: 1,
        textureScaleV: 1,
        lightColor: "white",
        lightScale: 1,
        lightDistance: 1,
        lightRadius: 0.3,
        lightHeight: 0.2
      };
      break;

    case "TAXIWAY":
      layer.dimensions = {
        ...layer.dimensions,
        sides: 4,
        diameter: 30,
        width: 50,
        length: 300,
        thickness: 0.6,
        rotation: 0,
        transparency: 1,
        baseHeight: 0,
        textureScaleU: 1,
        textureScaleV: 1,
        lineColor: "white",
        lineWidth: 0.5,
        lightColor: "white",
        lightScale: 1,
        lightDistance: 1,
        lightRadius: 0.3,
        lightHeight: 0.2
      };
      break;

    case "SHAPES":
      layer.dimensions = {
        ...layer.dimensions,
        sides: 4,
        diameter: 30,
        width: 100,
        length: 100,
        thickness: 0.4,
        rotation: 0,
        transparency: 1,
        baseHeight: 0,
        textureScaleU: 1,
        textureScaleV: 1,
        surfaceType: "concrete",
        markingColor: "yellow",
        lightColor: "white",
        lightScale: 1,
        lightDistance: 1,
        lightRadius: 0.3,
        lightHeight: 0.2
      };
      break;

    default:
      layer.dimensions = {
        ...layer.dimensions,
        sides: 4,
        diameter: 30,
        width: 30,
        length: 30,
        thickness: 0.5,
        rotation: 0,
        transparency: 1,
        baseHeight: 0,
        lightColor: "white",
        lightScale: 1,
        lightDistance: 1,
        lightRadius: 0.3,
        lightHeight: 0.2
      };
      break;
  }

  return { [layerType]: [layer] };
}

// --- Merge updates with existing JSON ---
function mergeUpdates(existingJson, data, userMesage, intent) {
  const updatedJson = { ...existingJson };
  const possibleLayers = ["FATO", "TLOF", "TAXIWAY", "SHAPE", "MODEL", "VOLUME", "FLIGHTPATH", "FLIGHTPATH_VFR"];

// Canonical → default display name
  const displayNames = {
    TLOF: "LANDING SURFACE",
    FATO: "GEOMETRY",
    TAXIWAY: "TAXIWAY",
    SHAPES: "SHAPES",
    MODEL: "MODEL LIBRARY",
    VOLUME: "OFV",
    FLIGHTPATH: "FLIGHT PATH",
    FLIGHTPATH_VFR: "OLS"
  };

  function normalizeName(name) {
    return (name || "").toLowerCase().replace(/[\s_]+/g, "");
  }

  function getNextLayerName(layerType) {
  const prefix = displayNames[layerType] || layerType;
  const existing = updatedJson[layerType] || [];
  let maxId = 0;

  existing.forEach(item => {
    const currentName = (item.dimensions?.layerName || "").replace(/\s+/g, "_");
    const normalizedPrefix = prefix.replace(/\s+/g, "_");
    const match = currentName.match(new RegExp(`^${normalizedPrefix}_(\\d+)$`, "i"));
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxId) maxId = num;
    }
  });

  return `${prefix}_${(maxId + 1).toString().padStart(3, "0")}`;
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
    position: updateObj.position ?? updatedJson[key][idx].position,
    isVisible: updateObj.isVisible ?? updatedJson[key][idx].isVisible,
    dimensions: {
      ...updatedJson[key][idx].dimensions,
      ...updateObj.dimensions
    }
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

// --- Select relevant JSON based on user intent & message ---
function getRelevantLayers(existingJson, selectedLayers, userMessage, intent) {
  const relevant = {};
  const normalizedMsg = userMessage.toUpperCase().replace(/\s+/g, ""); 
  // e.g. "update zone a" → "UPDATEZONEA"

  for (const layerType of selectedLayers) {
    const allLayers = existingJson[layerType] || [];

    if (intent === "update") {
      const matched = allLayers.filter(layer => {
        const layerNameNorm = (layer.dimensions?.layerName || "")
          .toUpperCase()
          .replace(/[\s_]+/g, "");

        const idNorm = layer.id ? layer.id.toUpperCase() : "";

        // Check if either ID or normalized layerName appears in user message
        return normalizedMsg.includes(layerNameNorm) || (idNorm && normalizedMsg.includes(idNorm));
      });

      // Only include layers that actually matched
      relevant[layerType] = matched; 
    } else if (intent === "create") {
      relevant[layerType] = [];
    }
  }

  return relevant;
}

// --- API Route Handler ---
export async function POST(req) {
  try {
    const body = await req.json();
    const messages = body.messages || [];
    const userMessage = messages[messages.length - 1]?.content || "";
    const existingJson = body.existingJson || {};

    if (!userMessage) {
      return NextResponse.json({ content: "No user message." }, { status: 400 });
    }

    let rawAnswer = "";
    let source = "";

    // --- Step 1: Azure Search ---
    const kbResult = await performAzureSearch(userMessage);
    if (kbResult.content) {
      console.log(`🔎 Azure Search result (score: ${kbResult.score.toFixed(2)}): "${kbResult.content.slice(0, 80)}..."`);
    } else {
      console.log("🔎 Azure Search returned no content");
    }

    if (kbResult.content && kbResult.score > 20) {
      rawAnswer = kbResult.content;
      source = "azure-search";
    } else {
      console.warn("⚠️ Falling back to Azure GPT-4 (no strong Azure Search result)");
      try {
        const resp = await azureGpt4.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4,
          messages: [
            { role: "system", content: `You are an aviation design assistant. Provide factual aircraft dimensions and layer suggestions in JSON.` },
            { role: "user", content: userMessage }
          ],
          max_tokens: 700,
        });
        rawAnswer = resp.choices?.[0]?.message?.content || "";
        source = "azure-gpt4";
        console.log("✅ GPT-4 provided the fallback answer");
      } catch (err) {
        console.error("❌ Azure GPT-4 failed:", err.message || err);
        rawAnswer = "{}";
        source = "error";
      }
    }

    //Detect user intent
   const intent = detectIntent(userMessage);  

    // Step 2: --- SELECT TEMPLATE BASED ON CONTEXT ---
let selectedLayers = [];
if (intent === "create") {
  selectedLayers = mapLayersFromUserMessage(userMessage); // keyword-based
} else if (intent === "update") {
  // For update, use top-level keys in existingJson
  selectedLayers = Object.keys(existingJson); // <-- use existingJson, NOT relevantJson
}

//Get relevant JSON for these layers
const relevantJson = getRelevantLayers(existingJson, selectedLayers, userMessage, intent);

// Load templates for those canonical layer types
const templates = selectedLayers
  .map(layerType => {
    const templateObj = getTemplateByName(layerType); // load each template by canonical type
    if (templateObj) {
      console.log(`📄 Using template: ${layerType} (from templates/${layerType.toLowerCase()}.json)`);
      return { layer: layerType, content: templateObj.content };
    } else {
      console.log(`📄 No template file for ${layerType}, filter will run without a template file.`);
      return null;
    }
  })
  .filter(Boolean); // remove nulls

    // Step 3: Filter with GPT-4.1-mini (we still call your azureGpt4 as filter in current code)
    let text = "";
    let data = {};
    try {
      // build filter prompt: include the large RULES + the selected template (if present)
      const filterPromptBase = `You are a filtering assistant.
### Task
- Take the raw GPT-4 factual answer.
- Keep the natural text explanation exactly (or correct if unsafe).
- Extract structured parameters, extract dimension data from azure search or gpt-4 in 'meters' always.
- Always return a single JSON object with this shape:

{
  "text": "<short explanation of what was done>",
  "data": {
    "TLOF": [...],
    "FATO": [...],
    "TAXIWAY": [...],
    "SHAPES": [...],
    "MODEL": [...],
    "VOLUME": [...],
    "FLIGHTPATH": [...],
    "FLIGHTPATH_VFR": [...]
  }
}

- "data" must always contain the selected templates filled with parameters from the user request.
- Never return {} for data.
- Only return data for the layers explicitly requested in the user's message: ${selectedLayers.join(", ")}.
- Do not create or duplicate other layer types.

Layer selection rules:
- If the user mentions ANY of these words → map to TLOF:
  ["tlof", "landing surface", "helipad", "landing area"]

- If the user mentions ANY of these words → map to FATO:
  ["fato", "geometry", "final approach", "approach area", "approach surface"]

- If the user mentions ANY of these words → map to TAXIWAY:
  ["taxiway", "taxi route", "taxi path"]

- If the user mentions ANY of these words → map to SHAPE:
  ["shape", "shapes"]

- If the user mentions ANY of these words → map to MODEL:
  ["model", "model library"]

- If the user mentions ANY of these words → map to VOLUME:
  ["ofv", "volume", "cylinder volume", "rectilinear volume"]

- If the user mentions ANY of these words → map to FLIGHTPATH:
  ["flightpath", "flight path"]

- If the user mentions ANY of these words → map to FLIGHTPATH_VFR:
  ["ols", "flightpath vfr"]

Additional constraints:
- Never create layers not explicitly requested by the user.
- If multiple synonyms appear in the same request, include each corresponding layer separately.
- Do not merge or combine different requested layer names into a single "layerName".
- Use the default values from the provided template unless the user explicitly overrides a parameter.

RULES:
- Aircraft dimensions must remain within published ranges.
- For all fields inside JSON layers:
  * Always update them if the user explicitly requests a change.
  * If the requested value is outside allowed options, replace with the nearest valid one and explain in "text".
- When the user requests **new layers**, create full valid JSON with new layer names.
- When the user requests **updates**, change only the required fields in the particular layerName.
- Never return FAA advisory text, long documents, or irrelevant data. Always return valid JSON.`;

      // If template exists, append it to prompt so filter enforces template structure
      let templateInstruction = "";
if (templates.length > 0) {
  templateInstruction =
    "\n\nSelected templates (enforce these JSON structures exactly):\n" +
    templates
      .map(t => `${t.layer}:\n${JSON.stringify(t.content, null, 2)}`)
      .join("\n\n");
}

      const filtered = await azureMini.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_MINI,
        messages: [
          { role: "system", content: filterPromptBase + templateInstruction },
          { role: "user", content: `User asked: ${userMessage}
          Relevant JSON: ${JSON.stringify(relevantJson)}
          Raw GPT-4 answer: ${rawAnswer}` },
        ],
        max_tokens: 700,
        temperature: 0.3,
      });

      const content = filtered.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(extractJson(content));
      text = parsed.text || rawAnswer;
      data = parsed.data || {};

      // Fallback if filter returned empty
  if (!data || Object.keys(data).length === 0) {
  console.warn("⚠️ Filter returned empty, creating default layers");
  data = {};
  for (const layer of selectedLayers) {
    data[layer] = createDefaultLayer(userMessage, layer)[layer];
  }
  if (!text) text = "Default layers created based on user request and PARAM_RULES.";
}

    } catch (err) {
      console.error("❌ Filtering failed:", err.message || err);
      data = createDefaultLayer(userMessage);
      text = "Default layer created ";
    }
    
    // --- Step 4: Merge AI updates into existing JSON safely ---
    const updatedJson = mergeUpdates(existingJson, data, userMessage, intent);

    // Final output
    console.log("🟢 User asked:", userMessage);
    console.log("📌 Answer source:", source);
    console.log("📝 Text response:", text);

    // Log relevant layers passed to Mini model
    console.log("🟡 Relevant JSON sent to Mini model:");
    Object.entries(relevantJson).forEach(([layerType, layers]) => {
    console.log(`- ${layerType}: ${layers.length} layer(s)`);
    layers.forEach(layer => {
    console.log(`  • LayerName: ${layer.dimensions?.layerName || "N/A"}, ID: ${layer.id || "N/A"}`);});});

    // Log Mini model input
    console.log("🤖 Mini model input:");
    console.log(JSON.stringify({ userMessage, relevantJson, templates }, null, 2));

    // Log Mini model output
    console.log("🟢 Mini model output (parsed):");
    console.log(JSON.stringify(data, null, 2));

    return NextResponse.json({
      source,
      rawAnswer,
      text,
      data,
      updatedJson,
      content: text,
    });

  } catch (err) {
    console.error("Server error:", err.message || err);
    return NextResponse.json({ content: "Server error" }, { status: 500 });
  }
}