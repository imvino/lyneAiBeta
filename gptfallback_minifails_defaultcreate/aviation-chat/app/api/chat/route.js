import { NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import axios from "axios";

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

// --- Parse aircraft name from user message ---
function parseAircraftName(text) {
  const match = text.match(/(?:for|of)\s+([A-Za-z0-9\- ]{2,50})/i);
  if (!match) return "001"; // fallback
  const name = match[1].trim().replace(/\s+/g, "").replace(/[^A-Za-z0-9]/g, "");
  return name || "001"; // fallback if empty after cleanup
}

// --- Parse layer type from user message ---
function parseLayerType(text) {
  const match = text.match(/\b(TLOF|FATO|TAXIWAY|SHAPES)\b/i);
  return match ? match[1].toUpperCase() : "TLOF";
}

// --- Create default layer if filter fails ---
// --- Create default layer if filter fails for a single requested layer ---
function createDefaultLayer(userMessage) {
  const aircraftName = parseAircraftName(userMessage);
  const layerType = parseLayerType(userMessage); // e.g., TLOF, FATO, TAXIWAY, SHAPES

  let layer = {
    position: [0, 0],
    isVisible: true,
    dimensions: { layerName: `${layerType}_${aircraftName}` }
  };

  // Layer-specific defaults
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
        sides: 6, // default hexagonal
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
      // Unknown layer, create minimal safe defaults
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
// Debug log: show Azure Search result & score
    if (kbResult.content) {
     console.log(`🔎 Azure Search result score: ${kbResult.score.toFixed(2)}`);
  } else {
     console.log("🔎 Azure Search returned no content");
  }

if (kbResult.content && kbResult.score > 20) {
  // Strong hit → use Azure Search
  rawAnswer = kbResult.content;
  source = "azure-search";
} else {
  console.warn("⚠️ Falling back to Azure GPT-4 (no strong Azure Search result)");

      // Step 2: GPT-4 fallback
      try {
        const resp = await azureGpt4.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4,
          messages: [
            {role: "system",content: `You are an aviation design assistant. Provide factual aircraft dimensions and layer suggestions in JSON.`},
            { role: "user", content: userMessage }], max_tokens: 700,});
        rawAnswer = resp.choices?.[0]?.message?.content || "";
        source = "azure-gpt4";
        console.log("✅ GPT-4 provided the fallback answer");
    } catch (err) {
      console.error("❌ Azure GPT-4 failed:", err.message);
      rawAnswer = "{}";
      source = "error";
  }
}

    // Step 3: Filter with GPT-4.1-mini
    let text = "";
    let data = {};
    try {
      const filterPrompt = `You are a filtering assistant.
### Task
- Take the raw GPT-4 factual answer.
- Keep the natural text explanation exactly (or correct if unsafe).
- Extract structured parameters, extract dimension data from azure search or gpt-4 in 'meters' always.
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
- For categorical fields (like tdpcColor, markingColor, markerColor, lightColor):
  * Always update them if the user explicitly requests a change.
  * If the requested value is outside allowed options,  JSON gets the nearest valid value, and the "text" explanation mentions the substitution.
- When the user requests **new layers**, create full valid JSON with new layer names.
- When the user requests **updates**, change only the required fields in the particular layerName.
- Always use aircraft name along with layer name if mentioned by user or take from raw answer (Eg:TLOF_JobyS4) or if nothing found give 'layername_series' (Eg:TLOF_001 or FATO_001).
- If the user says "landing surface", always map it to **TLOF** only & if "geometry", always map it to **FATO** only.
`;

      const filtered = await azureMini.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_MINI,
        messages: [
          { role: "system", content: filterPrompt },
          { role: "user", content: `User asked: ${userMessage}\n\nExisting JSON: ${JSON.stringify(existingJson)}\n\nRaw GPT-4 answer: ${rawAnswer}` },
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
        console.warn("⚠️ Filter returned empty, creating default layer");
        data = createDefaultLayer(userMessage);
        text = "Default layer created based on user request and PARAM_RULES.";
      }
    } catch (err) {
      console.error("❌ Filtering failed:", err.message);
      data = createDefaultLayer(userMessage);
      text = "Default layer created ";
    }

    // Step 4: Merge AI updates into existing JSON safely
    const updatedJson = mergeUpdates(existingJson, data, userMessage);

function mergeUpdates(existingJson, data, userMessage) {
  let updatedJson = existingJson || {};
  const possibleLayers = ["FATO", "TLOF", "TAXIWAY", "SHAPES"];
  let layerUpdates = {};

  // --- Normalize layer names (remove spaces/underscores, lowercase) ---
  function normalizeName(name) {
    return (name || "").toString().toLowerCase().replace(/[\s_]+/g, "");
  }

  // --- Detect intent from user message ---
  function detectIntent(msg) {
    msg = msg.toLowerCase();
    if (msg.includes("create") || msg.includes("add") || msg.includes("new") || msg.includes("another") || msg.includes("make")) {
      return "create";
    }
    if (msg.includes("update") || msg.includes("change") || msg.includes("modify") || msg.includes("set") || msg.includes("give")) {
      return "update";
    }
    return "unknown";
  }
  const intent = detectIntent(userMessage);

  // --- Helper: find next available ID ---
  function getNextLayerName(layerType) {
    const existing = updatedJson[layerType] || [];
    let maxId = 0;

    existing.forEach(item => {
      const name = item.dimensions?.layerName || "";
      const match = name.match(new RegExp(`^${layerType}_(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    });

    const nextId = (maxId + 1).toString().padStart(3, "0");
    return `${layerType}_${nextId}`;
  }

  // Collect updates for multiple layers
  for (const key of possibleLayers) {
    if (data[key]) layerUpdates[key] = data[key];
  }

  if (Object.keys(layerUpdates).length > 0) {
    // Apply updates per layer
    for (const [layerType, updates] of Object.entries(layerUpdates)) {
      if (!Array.isArray(updatedJson[layerType])) updatedJson[layerType] = [];

      updates.forEach(updateObj => {
        let targetLayerName = updateObj.dimensions?.layerName || null;

        if (targetLayerName) {
          // Normalize layer name for matching
          targetLayerName = normalizeName(targetLayerName);
        }

        // --- Try to find existing layer (normalized) ---
        const idx = updatedJson[layerType].findIndex(
          item => normalizeName(item.dimensions?.layerName) === targetLayerName
        );

        if (idx !== -1 && intent === "update") {
          // Update existing layer
          updatedJson[layerType][idx] = {
            ...updatedJson[layerType][idx],
            dimensions: {
              ...updatedJson[layerType][idx].dimensions,
              ...updateObj.dimensions,
            },
          };
          console.log(`🔄 Updated layer: ${updatedJson[layerType][idx].dimensions.layerName}`);
        } else {
          // Create new layer if not found or intent=create
          const newName = updateObj.dimensions?.layerName
            ? updateObj.dimensions.layerName
            : getNextLayerName(layerType);

          // Prevent exact duplicate creation
          if (!updatedJson[layerType].some(item => normalizeName(item.dimensions?.layerName) === normalizeName(newName))) {
            updatedJson[layerType].push({
              position: updateObj.position || [-73.7855, 40.645],
              isVisible: updateObj.isVisible ?? true,
              dimensions: { ...updateObj.dimensions, layerName: newName },
            });
            console.log(`✨ Created new layer: ${newName}`);
          }
        }
      });
    }
  } else {
    // Single layer update fallback
    const { layer, layerName, ...fields } = data;
    const targetLayer = layer || "TLOF";

    if (!Array.isArray(updatedJson[targetLayer])) updatedJson[targetLayer] = [];

    const idx = updatedJson[targetLayer].findIndex(
      item => normalizeName(item.dimensions?.layerName) === normalizeName(layerName)
    );

    if (idx !== -1 && intent === "update") {
      updatedJson[targetLayer][idx] = {
        ...updatedJson[targetLayer][idx],
        dimensions: { ...updatedJson[targetLayer][idx].dimensions, ...fields },
      };
      console.log(`🔄 Updated layer: ${layerName}`);
    } else {
      const newName = layerName || getNextLayerName(targetLayer);
      updatedJson[targetLayer].push({
        position: [-73.7855, 40.645],
        isVisible: true,
        dimensions: { layerName: newName, ...fields },
      });
      console.log(`✨ Created new layer: ${newName}`);
    }
  }

  return updatedJson;
}

    // Final output
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
