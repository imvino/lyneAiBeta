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
      `${process.env.AZURE_SEARCH_SERVICE_ENDPOINT}/indexes/${process.env.AZURE_SEARCH_INDEX_NAME}/docs/search?api-version=2021-04-30-Preview`,
      { search: query, top: 1, select: "content", queryType: "simple" },
      { headers: { "Content-Type": "application/json", "api-key": process.env.AZURE_SEARCH_ADMIN_KEY } }
    );
    return response.data.value.length ? response.data.value[0].content : "";
  } catch (e) {
    console.error("Azure Search failed:", e.message);
    return "";
  }
}

// --- Helper: Validate Azure Search content ---
function isSearchContentValid(content) {
  if (!content) return false;

  const designKeywords = [
    "vertipad",
    "helipad",
    "pad",
    "design",
    "dimension",
    "diameter",
    "length",
    "width"
  ];
  const hasKeyword = designKeywords.some(k => content.toLowerCase().includes(k));

  return hasKeyword && content.length > 50; // must have keywords + enough substance
}

// --- Extract JSON object from model output ---
function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : "{}";
}

// --- API Route Handler ---
export async function POST(req) {
  try {
    const body = await req.json();
    const messages = body.messages || [];
    const userMessage = messages[messages.length - 1]?.content || "";

    if (!userMessage) {
      return NextResponse.json({ content: "No user message." }, { status: 400 });
    }

    let rawAnswer = "";
    let source = "";

    // Step 1: Azure Search
    const kbContent = await performAzureSearch(userMessage);

    if (isSearchContentValid(kbContent)) {
      rawAnswer = kbContent;
      source = "azure-search";
    } else {
      // Step 2: GPT-4 fallback
      try {
        const resp = await azureGpt4.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4,
          messages: [
            {
              role: "system",
              content: `You are an aviation design assistant.
If no data is available from the knowledge base,
use known aircraft dimensions or ICAO defaults to propose a design.
Never return just a disclaimer.`
            },
            { role: "user", content: userMessage }
          ],
          max_tokens: 700,
        });
        rawAnswer = resp.choices?.[0]?.message?.content || "";
        source = "azure-gpt4";
      } catch (err) {
        console.error("Azure GPT-4 failed:", err.message);
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
- Extract structured parameters.
- Always return JSON output following this schema:
{
  "text": "<short natural explanation>",
  "data": {
    "FATO": [
      {
        "position": "([number, number], Latitude & Longitude in WGS84. Clamp Lat -90..90, Lon -180..180)",
        "isVisible": "(boolean, Default: true)",
        "dimensions": {
          
          "sides": "(integer, Range: 3-12, Default: 4)",
          "width": "(number, Range: 0.1-100, Default: 30)",
          "length": "(number, Range: 0.1-100, Default: 30)",
          "thickness": "(number, Range: 0.01-1.0, Default: 0.5)",
          "rotation": "(number, Range: 0-360, Default: 0)",
          "transparency": "(number, Range: 0.0-1.0, Default: 1.0)",
          "baseHeight": "(number, Range: 0-10, Default: 0)",
          "layerName": "(string, Must be unique per session. Default: 'FATO_aircraft')",
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
          "width": "(number, Range: 0.1-100, Default: 30)",
          "length": "(number, Range: 0.1-100, Default: 30)",
          "thickness": "(number, Range: 0.01-1.0, Default: 0.5)",
          "rotation": "(number, Range: 0-360, Default: 0)",
          "transparency": "(number, Range: 0.0-1.0, Default: 1.0)",
          "baseHeight": "(number, Range: 0-10, Default: 0)",
          "textureScaleU": "(number, Range: 0.1-10, Default: 1)",
          "textureScaleV": "(number, Range: 0.1-10, Default: 1)",
          "layerName": "(string, Must be unique per session. Default: 'TLOF_aircraft')",
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
- Return the response in JSON format along with a text defining the reason if user suggests invalid values:
  - In "text", explain the corrected values only in short words.
  - In "data", set corrected safe values.
- When the user requests changes, respond only with the fields that should be updated, do not return the full JSON.`
    ;

      const filtered = await azureMini.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_MINI,
        messages: [
          { role: "system", content: filterPrompt },
          { role: "user", content: `User asked: ${userMessage}\n\nRaw GPT-4 answer: ${rawAnswer}` },
        ],
        max_tokens: 700,
        temperature: 0.3,
      });

      const content = filtered.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(extractJson(content));

      text = parsed.text || rawAnswer;
      data = parsed.data || {};
    } catch (err) {
      console.error("Filtering failed:", err.message);
      text = rawAnswer;
      data = { raw: rawAnswer };
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
      content: text, // alias for frontend UI
    });
  } catch (err) {
    console.error("Server error:", err.message);
    return NextResponse.json({ content: "Server error" }, { status: 500 });
  }
}