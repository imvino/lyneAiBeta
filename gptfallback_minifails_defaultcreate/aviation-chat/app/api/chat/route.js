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

// --- Normalize JSON: supports array-of-objects or object form ---
// Ensures all known layers exist as arrays.
function normalizeJson(input) {
  const possibleLayers = [
    "FATO",
    "TLOF",
    "TAXIWAY",
    "SHAPE",
    "MODEL",
    "VOLUME",
    "FLIGHTPATH",
    "FLIGHTPATH_VFR"
  ];

  let normalized;

  if (Array.isArray(input)) {
    // Merge array-of-objects into a single object
    normalized = input.reduce((acc, obj) => {
      for (const key in obj) {
        if (Array.isArray(obj[key])) {
          if (!acc[key]) acc[key] = [];
          acc[key] = acc[key].concat(obj[key]);
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          acc[key] = { ...(acc[key] || {}), ...obj[key] };
        } else {
          acc[key] = obj[key];
        }
      }
      return acc;
    }, {});
  } else {
    normalized = { ...(input || {}) };
  }

  // ✅ Ensure all possibleLayers are arrays
  for (const layer of possibleLayers) {
    if (!Array.isArray(normalized[layer])) {
      normalized[layer] = [];
    }
  }

  return normalized;
}

// --- Map user message to layer types (plural) ---
function mapLayersFromUserMessage(msg) {
  const text = msg.toLowerCase().replace(/[\s_]+/g, " "); // normalize spaces & underscores
  const layers = [];

  // --- Special rule for landing pad ---  }
  if (/landing pad|helipad/i.test(text)) {
    layers.push("TLOF", "FATO");
  }

  // --- Synonyms dictionary for layer mapping ---
const synonyms = {
  TLOF: ["tlof", "landing surface", "landing area"],
  FATO: ["fato", "geometry", "final approach", "approach area", "approach surface"],
  TAXIWAY: ["taxiway", "taxi route", "taxi path"],
  SHAPE: ["shape", "shapes"],
  MODEL: ["model library", "model", "crane", "truck", "hanger", "storage", "aircraft", "container", "electric", "charging", "tree", "connector"],
  VOLUME: ["ofv", "volume", "cylinder volume", "rectilinear volume"],
  FLIGHTPATH: ["flightpath", "flight path", "runway"],
  FLIGHTPATH_VFR: ["ols", "flightpath vfr"]
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
  if (msg.includes("create") || msg.includes("add") || msg.includes("new") || msg.includes("another") || msg.includes("generate") || msg.includes("insert") || msg.includes("make")) return "create";
  if (msg.includes("update") || msg.includes("change") || msg.includes("modify") || msg.includes("set") || msg.includes("rotate") || msg.includes("move") || msg.includes("resize") || msg.includes("shift") || msg.includes("adjust") || msg.includes("position") || msg.includes("park") || msg.includes("give")) return "update";
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

// --- Merge updates with existing JSON (support update by layerName or ID) ---
function mergeUpdates(existingJson, data, userMessage, intent) {
  const updatedJson = normalizeJson(existingJson); // ✅ always safe
  const possibleLayers = ["FATO", "TLOF", "TAXIWAY", "SHAPE", "MODEL", "VOLUME", "FLIGHTPATH", "FLIGHTPATH_VFR"];

// Canonical → default display name
  const displayNames = {
    TLOF: "LANDING SURFACE",
    FATO: "GEOMETRY",
    TAXIWAY: "TAXIWAY",
    SHAPE: "SHAPES",
    MODEL: "MODEL LIBRARY",
    VOLUME: "OFV",
    FLIGHTPATH: "FLIGHT PATH",
    FLIGHTPATH_VFR: "OLS"
  };

  function normalizeName(name) {
    return (name || "").toLowerCase().replace(/[\s_]+/g, "");
  }

  function getNextLayerName(layerType) {
    const existing = updatedJson[layerType];
    let maxId = 0;

    // Base name from first existing item or display name
    let baseName = displayNames[layerType] || layerType;
    if (existing.length > 0) {
      const firstName = existing[0].dimensions?.layerName || "";
      baseName = firstName.replace(/\s*\(\d+\)$/, ""); // strip (N)
    }

    existing.forEach(item => {
      const currentName = item.dimensions?.layerName || "";
      const match = currentName.match(new RegExp(`^${baseName}\\s*\\((\\d+)\\)$`, "i"));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    });

    return `${baseName} (${maxId + 1})`;
  }

  for (const key of possibleLayers) {
    if (!data[key]) continue;

    data[key].forEach(updateObj => {
      if (intent === "update") {
        const idx = updatedJson[key].findIndex(l =>
          (l.id && l.id === updateObj.id) ||
          normalizeName(l.dimensions?.layerName) === normalizeName(updateObj.dimensions?.layerName)
        );

        if (idx !== -1) {
          updatedJson[key][idx] = {
            ...updatedJson[key][idx],
            position: updateObj.position ?? updatedJson[key][idx].position,
            isVisible: updateObj.isVisible ?? updatedJson[key][idx].isVisible,
            dimensions: {
              ...updatedJson[key][idx].dimensions,
              ...updateObj.dimensions
            },
            id: updateObj.id ?? updatedJson[key][idx].id
          };
          return; // skip creation
        }
      }

      // Create new layer if intent is create or no existing layer found
      const newName = getNextLayerName(key);
      updatedJson[key].push({
        position: updateObj.position || [0, 0],
        isVisible: updateObj.isVisible ?? true,
        dimensions: { ...updateObj.dimensions, layerName: newName },
        id: updateObj.id || `${key}-${Date.now()}`
      });
    });
  }

  return updatedJson;
}

// --- Select relevant JSON based on user intent & message ---
function getRelevantLayers(existingJson, selectedLayers, userMessage, intent) {
  const relevant = {};
  const msgUpper = userMessage.toUpperCase();
  const errors = [];

  // Canonical → display names
  const displayNames = {
    TLOF: "LANDING SURFACE",
    FATO: "GEOMETRY",
    TAXIWAY: "TAXIWAY",
    SHAPE: "SHAPES",
    MODEL: "MODEL LIBRARY",
    VOLUME: "OFV",
    FLIGHTPATH: "FLIGHT PATH",
    FLIGHTPATH_VFR: "OLS"
  };

  for (const layerType of selectedLayers) {
    const allLayersRaw = existingJson[layerType];
    const allLayers = Array.isArray(allLayersRaw) ? allLayersRaw : [];
    const baseName = displayNames[layerType] || layerType;

    // Regex to match "BASE 1", "BASE (1)", "BASE1" in the message
    const regex = new RegExp(`${baseName}\\s*\\(?\\s*(\\d+)\\s*\\)?`, "gi");

    // Collect all layer numbers mentioned in message for this type
    const layerNumbersInMsg = [];
    let match;
    while ((match = regex.exec(msgUpper)) !== null) {
      layerNumbersInMsg.push(match[1]); // e.g., "1", "2"
    }

    // Filter existing layers that match these numbers OR have matching ID
    const matched = allLayers.filter(layer => {
      const layerName = layer.dimensions?.layerName || "";
      const normName = layerName.toUpperCase().replace(/[\s_]+/g, "").replace(/\(|\)/g, "");
      const idNorm = layer.id ? layer.id.toUpperCase() : "";

      // Match if either numbered name matches OR layer ID appears in message
      const nameMatch = layerNumbersInMsg.some(num => normName === (baseName + num).replace(/[\s_]+/g, ""));
      const idMatch = idNorm && msgUpper.includes(idNorm);

      return nameMatch || idMatch;
    });

    // For both update + create → return matches if found
    relevant[layerType] = matched;
  
    // ❌ Handle update fallback: no matches found
    if (intent === "update" && matched.length === 0 && (layerNumbersInMsg.length > 0 || msgUpper.includes("ID"))) {
     const availableNames = allLayers.map(l => l.dimensions?.layerName || l.id).join(", ") || "None";
     errors.push(`No such ${baseName} found. Available ${baseName}s: ${availableNames}`);
    }
  }

  // If any errors were collected, return them instead of empty matches
  if (errors.length > 0) {
    return { error: errors.join(" | ") };
  }

  return relevant;
}

// --- API Route Handler ---
export async function POST(req) {
  const startTime = Date.now(); // mark start
  try {
    const body = await req.json();
    const messages = body.messages || [];
    const userMessage = messages[messages.length - 1]?.content || "";
    const existingJson = normalizeJson(body.existingJson || {});

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
  // For updates, consider all layers the user actually mentioned
  selectedLayers = mapLayersFromUserMessage(userMessage);
}

//Get relevant JSON for these layers
const relevantJson = getRelevantLayers(existingJson, selectedLayers, userMessage, intent);
if (relevantJson.error) {
  // 🚨 Show user the error instead of continuing
  console.log("⚠️", relevantJson.error);
  return NextResponse.json({ error: relevantJson.error });
}

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
    "FATO": [],
    "TLOF": [],
    "TAXIWAY": [],
    "SHAPE": [],
    "MODEL": [],
    "VOLUME": [],
    "FLIGHTPATH": [],
    "FLIGHTPATH_VFR": []
  }
}

- "data" must always contain the selected templates filled with parameters from the user request.
- Never return {} for data.
- Only return data for the layers explicitly requested in the user's message: ${selectedLayers.join(", ")}.
- Do not create or duplicate other layer types.

Layer selection rules:
- If the user mentions ANY of these words → map to TLOF:
  ["tlof", "landing surface", "landing area"]

- If the user mentions ANY of these words → map to FATO:
  ["fato", "geometry", "final approach", "approach area", "approach surface"]

- If the user mentions ANY of these words → map to TAXIWAY:
  ["taxiway", "taxi route", "taxi path"]

- If the user mentions ANY of these words → map to SHAPE:
  ["shape", "shapes"]

- If the user mentions ANY of these words → map to MODEL:
  ["model", "model library", "crane", "truck", "hanger", "storage", "aircraft", "container", "electric", "charging", "tree", "connector" ]

- If the user mentions ANY of these words → map to VOLUME:
  ["ofv", "volume", "cylinder volume", "rectilinear volume"]

- If the user mentions ANY of these words → map to FLIGHTPATH:
  ["flightpath", "flight path", "runway"]

- If the user mentions ANY of these words → map to FLIGHTPATH_VFR:
  ["ols", "flightpath vfr"]

- If the user mentions “landing pad” or “helipad” , then you must always create both TLOF and FATO layers together.
  TLOF → returned as "layerName": "LANDING SURFACE"
  FATO → returned as "layerName": "GEOMETRY"

Additional constraints:
- Never create layers not explicitly requested by the user.
- If multiple synonyms appear in the same request, include each corresponding layer separately.
- Do not merge or combine different requested layer names into a single "layerName".
- Use the default values from the provided template unless the user explicitly overrides a parameter.

Position Rules:
- If the user requests a relative movement (e.g., "10cm north", "0.5m east"):
  * Calculate the absolute coordinates from the existing position.
  * Convert all distances to meters (1cm = 0.01m).
  * Update the "position" array in the JSON layer accordingly.
  * Never leave "position" undefined if a movement is requested.
- If the user specifies “from layer 1 to layer 2” (e.g., taxiway, flightpath), use the positions of both referenced layers as start and end points: 
  "position": [
  <position of layer 1>,
  <position of layer 2>
  ]
 
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
    
    const endTime = Date.now(); // mark end
    const responseTimeMs = endTime - startTime; 
    console.log(`⏱ Response time: ${responseTimeMs} ms`); 

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
      responseTimeMs,
      data,
      updatedJson,
      content: text,
    });

  } catch (err) {
    console.error("Server error:", err.message || err);
    return NextResponse.json({ content: "Server error" }, { status: 500 });
  }
}