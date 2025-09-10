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
  return match ? match[1].toUpperCase() : "TLOF"; // by default why it is choosing TLOF which is causing error while update
}

// --- Tiny template loader: loads templates/<name>.json from repo root ---
const TEMPLATES_DIR = path.join(process.cwd(), "templates");
function getTemplateByName(name) {
  try {
    const file = path.join(TEMPLATES_DIR, `${name.toLowerCase()}.json`);
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    // We expect template content to live under parsed.content (as you've planned)
    return parsed;
  } catch (err) {
    console.warn("template load failed:", err?.message || err);
    return null;
  }
}

// --- Create default layer if filter fails ---
function createDefaultLayer(userMessage) {
  const aircraftName = parseAircraftName(userMessage);
  const layerType = parseLayerType(userMessage); // e.g., TLOF, FATO, TAXIWAY, SHAPES

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

    // --- SELECT TEMPLATE BASED ON USER INPUT (minimal change) ---
    // Preference: explicit "use <TLOF|FATO|...>" in user message; otherwise parse from content.
    const selectedLayer = parseLayerType(userMessage); // parseLayerType now checks explicit "use X"
    const templateObj = getTemplateByName(selectedLayer); // tries templates/tlof.json (lowercased)
    console.log("userMessage :", userMessage);
    console.log("selectedLayer :", selectedLayer);
    console.log("templateObj :", templateObj);

    if (templateObj) {
      console.log(`📄 Using template: ${selectedLayer} (from templates/${selectedLayer.toLowerCase()}.json)`);
    } else {
      console.log(`📄 No template file for ${selectedLayer}, filter will run without a template file.`);
    }

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
- Give output in json format.
- ALWAYS RETURN FULL JSON OUTPUT.

Always return JSON output following this schema:
{ ... }  // <-- keep your existing big schema EXACTLY as before (omitted here for brevity)
RULES:
- Aircraft dimensions must remain within published ranges.
- For categorical fields (like tdpcColor, markingColor, markerColor, lightColor):
  * Always update them if the user explicitly requests a change.
  * If the requested value is outside allowed options, replace with the nearest valid one and explain in "text".
- When the user requests **new layers**, create full valid JSON with new layer names.
- When the user requests **updates**, change only the required fields in the particular layerName.
- Always use aircraft name along with layer name if mentioned by user or take from raw answer (Eg:TLOF_JobyS4) or if nothing found give 'layername_series' (Eg:TLOF_001 or FATO_001).
- Never return FAA advisory text, long documents, or irrelevant data. Always return valid JSON.`;

      // If template exists, append it to prompt so filter enforces template structure
      const templateInstruction = templateObj
        ? `\n\nSelected template for ${selectedLayer} (enforce this JSON structure exactly):\n${JSON.stringify(templateObj.content, null, 2)}`
        : "";
      console.log("📝 templateInstruction:", templateInstruction);
      const filtered = await azureMini.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_MINI,
        messages: [
          { role: "system", content: filterPromptBase + templateInstruction },
          { role: "user", content: `User asked: ${userMessage}\n\nExisting JSON: ${JSON.stringify(existingJson)}\n\nRaw GPT-4 answer: ${rawAnswer}` },
        ],
        max_tokens: 700,
        temperature: 0.3,
      });

 console.log(" filtered:", filtered);
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
      console.error("❌ Filtering failed:", err.message || err);
      data = createDefaultLayer(userMessage);
      text = "Default layer created ";
    }

    // Step 4: Merge AI updates into existing JSON safely (unchanged)
    let updatedJson = { ...existingJson };
    const possibleLayers = ["FATO", "TLOF", "TAXIWAY", "SHAPES"];

    for (const layerKey of possibleLayers) {
      
      if (data[layerKey]) {
        console.log("layerKey :", layerKey);
        if (!Array.isArray(updatedJson[layerKey])) updatedJson[layerKey] = [];

        data[layerKey].forEach(updateObj => {
          const targetLayerName = updateObj.dimensions?.layerName || null;
          if (!targetLayerName) return;

          const idx = updatedJson[layerKey].findIndex(
            item => item.dimensions?.layerName === targetLayerName
          );
          console.log("idx :", idx);
          if (idx !== -1) {
            // Update existing layer
            updatedJson[layerKey][idx] = {
              ...updatedJson[layerKey][idx],
              dimensions: { ...updatedJson[layerKey][idx].dimensions, ...updateObj.dimensions },
            };
          } else {
            // Create new layer
            updatedJson[layerKey].push(updateObj);
          }
        });
      }
    }

    // Final output
    console.log("🟢 User asked:", userMessage);
    console.log("📌 Answer source:", source);
    console.log("📝 Text response:", text);
    console.log("📝 existingJson:", existingJson);
    // console.log("📝 rawAnswer:", rawAnswer);
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
