// --- RULES: defaults + ranges + enums ---
export const PARAM_RULES = {
  FATO: {
    sides: { default: 4, min: 3, max: 12 },
    diameter: { default: 30, min: 0.1, max: 100 },
    width: { default: 30, min: 0.1, max: 100 },
    length: { default: 30, min: 0.1, max: 100 },
    thickness: { default: 0.5, min: 0.01, max: 1.0 },
    rotation: { default: 0, min: 0, max: 360 },
    transparency: { default: 1, min: 0.0, max: 1.0 },
    baseHeight: { default: 0, min: 0, max: 10 },
    layerName: { default: "FATO_Unknown" },
    textureScaleU: { default: 1, min: 0.1, max: 10 },
    textureScaleV: { default: 1, min: 0.1, max: 10 },
    lightColor: { default: "white", allowed: ["white", "yellow", "red", "blue"] },
    lightScale: { default: 1, min: 0.1, max: 5 },
    lightDistance: { default: 1, min: 0.1, max: 10 },
    lightRadius: { default: 0.3, min: 0.1, max: 5 },
    lightHeight: { default: 0.2, min: 0.1, max: 5 }
  },
  TLOF: {
    sides: { default: 4, min: 3, max: 12 },
    diameter: { default: 30, min: 0.1, max: 100 },
    width: { default: 30, min: 0.1, max: 100 },
    length: { default: 30, min: 0.1, max: 100 },
    thickness: { default: 0.5, min: 0.01, max: 1.0 },
    rotation: { default: 0, min: 0, max: 360 },
    transparency: { default: 1, min: 0.0, max: 1.0 },
    baseHeight: { default: 0, min: 0, max: 10 },
    textureScaleU: { default: 1, min: 0.1, max: 10 },
    textureScaleV: { default: 1, min: 0.1, max: 10 },
    layerName: { default: "TLOF_Unknown" },
    markingType: { default: "dashed", allowed: ["solid", "dashed"] },
    markingColor: { default: "white", allowed: ["white", "yellow", "red", "blue"] },
    markingThickness: { default: 0.5, min: 0.2, max: 1.0 },
    dashDistance: { default: 1, min: 0.5, max: 3.0 },
    dashLength: { default: 1, min: 0.5, max: 3.0 },
    landingMarker: { default: "H", allowed: ["H", "V"] },
    markerScale: { default: 5, min: 0.1, max: 20 },
    markerThickness: { default: 0.5, min: 0.2, max: 1.0 },
    letterThickness: { default: 0.5, min: 0.2, max: 1.0 },
    markerRotation: { default: 0, min: 0, max: 360 },
    markerColor: { default: "blue", allowed: ["white", "yellow", "red", "blue"] },
    tdpcType: { default: "Circle", allowed: ["Circle", "Cross", "Square"] },
    tdpcScale: { default: 5, min: 0.1, max: 20 },
    tdpcThickness: { default: 0.5, min: 0.01, max: 1.0 },
    tdpcExtrusion: { default: 0.02, min: 0.0, max: 1.0 },
    tdpcRotation: { default: 0, min: 0, max: 360 },
    tdpcColor: { default: "white", allowed: ["white", "yellow", "red", "blue"] },
    lightColor: { default: "white", allowed: ["white", "yellow", "red", "blue"] },
    lightScale: { default: 1, min: 0.1, max: 5 },
    lightDistance: { default: 1, min: 0.1, max: 10 },
    lightRadius: { default: 0.3, min: 0.1, max: 5 },
    lightHeight: { default: 0.2, min: 0.1, max: 5 },
    safetyAreaType: { default: "multiplier", allowed: ["multiplier", "offset"] },
    offsetDistance: { default: 3, min: 0.1, max: 50 },
    dValue: { default: 10, min: 1, max: 100 },
    multiplier: { default: 1.5, min: 0.1, max: 10 },
    curveAngle: { default: 45, min: 0, max: 90 },
    safetyNetHeight: { default: 15, min: 0.1, max: 50 },
    safetyNetTransparency: { default: 0.5, min: 0.0, max: 1.0 },
    safetyNetScaleU: { default: 1, min: 0.1, max: 10 },
    safetyNetScaleV: { default: 1, min: 0.1, max: 10 },
    safetyNetColor: { default: "white", allowed: ["white", "yellow", "red", "blue"] }
  },
  TAXIWAY: {
    width: { default: 10, min: 0.1, max: 100 },
    length: { default: 50, min: 1, max: 500 },
    thickness: { default: 0.2, min: 0.01, max: 1.0 },
    rotation: { default: 0, min: 0, max: 360 },
    transparency: { default: 1, min: 0.0, max: 1.0 },
    baseHeight: { default: 0, min: 0, max: 10 },
    layerName: { default: "TAXIWAY_Unknown" },
    lineWidth: { default: 0.5, min: 0.1, max: 5 },
    color: { default: "yellow", allowed: ["white", "yellow", "red", "blue"] },
    dashGap: { default: 2, min: 0.1, max: 10 },
    endPoint: { default: null },
    lineStyle: { default: "solid", allowed: ["solid", "dashed"] }
  },
  SHAPES: {
    shape: { default: "circle", allowed: ["circle", "square", "polygon"] },
    size: { default: 5, min: 0.1, max: 100 },
    diameter: { default: 30, min: 0.1, max: 100 },
    width: { default: 0.3, min: 0.1, max: 10 },
    height: { default: 0.1, min: 0.1, max: 10 },
    rotation: { default: 0, min: 0, max: 360 },
    transparency: { default: 1, min: 0.0, max: 1.0 },
    baseHeight: { default: 0, min: 0, max: 10 },
    layerName: { default: "SHAPES_Unknown" },
    color: { default: "white", allowed: ["white", "yellow", "red", "blue"] },
    dashGap: { default: 2, min: 0.1, max: 10 },
    endPoint: { default: null },
    lineStyle: { default: "solid", allowed: ["solid", "dashed"] },
    lineWidth: { default: 0.5, min: 0.1, max: 5 }
  }
};

// utils/rules.js

// --- Apply business rules to a layer (example placeholder) ---
function applyRules(layerType, dimensions) {
  // You can enforce restrictions here if needed
  return dimensions;
}

// --- Create a default layer when filter completely fails ---
function createDefaultLayer(layerType, userMessage) {
  return {
    position: [0, 0],
    isVisible: true,
    dimensions: {
      layerName: `${layerType}_001`
    }
  };
}

// --- Multi-Layer Dynamic Fallback Parser (generic with PARAM_RULES) ---
function multiLayerFallbackParser(userJson, userMessage) {
  userMessage = userMessage || "";
  const newJson = JSON.parse(JSON.stringify(userJson)); // deep copy
  const layerTypes = Object.keys(PARAM_RULES);

  // Regex to match layer names (e.g., FATO_001, TLOF_ABC)
  const layerNameRegex = /\b([A-Z]+_\d+|[A-Z]+_[A-Z]+)\b/g;
  const msg = typeof userMessage === "string" ? userMessage : "";
  const foundLayerNames = [...msg.matchAll(layerNameRegex)].map(m => m[0]);

  // Regex for numbers
  const numberRegex = /(\d+(\.\d+)?)(m)?/g;

  // Regex for colors (expanded list)
  const colorRegex = /\b(red|blue|green|yellow|purple|white|black|orange|pink|brown|gray)\b/i;

  foundLayerNames.forEach(layerName => {
    let layerType = null;

    // Guess type by prefix
    for (const type of layerTypes) {
      if (layerName.startsWith(type)) {
        layerType = type;
        break;
      }
    }
    if (!layerType) layerType = "TLOF"; // fallback

    if (!newJson[layerType]) newJson[layerType] = [];

    // Find existing layer or create
    let layer = newJson[layerType].find(l => l.dimensions.layerName === layerName);
    if (!layer) {
      layer = { position: [0, 0], isVisible: true, dimensions: { layerName } };
      newJson[layerType].push(layer);
    }

    const dims = layer.dimensions;

    // Extract context (sentence around layerName)
    const layerContextRegex = new RegExp(`${layerName}([^.]*)`, "i");
    const layerContextMatch = msg.match(layerContextRegex);
    const layerContext = layerContextMatch ? layerContextMatch[1] : "";

    // 🔹 Match numeric values dynamically against PARAM_RULES
    [...layerContext.matchAll(numberRegex)].forEach(match => {
      const value = parseFloat(match[1]);

      for (const [param, rules] of Object.entries(PARAM_RULES[layerType])) {
        if (new RegExp(param, "i").test(layerContext)) {
          // Clamp to allowed range
          let safeValue = value;
          if (rules.min !== undefined) safeValue = Math.max(safeValue, rules.min);
          if (rules.max !== undefined) safeValue = Math.min(safeValue, rules.max);
          dims[param] = safeValue;
        }
      }
    });

    // 🔹 Match color values dynamically
    const colorMatch = layerContext.match(colorRegex);
    if (colorMatch) {
      const color = colorMatch[0].toLowerCase();

      for (const [param, rules] of Object.entries(PARAM_RULES[layerType])) {
        if (rules.allowed && rules.allowed.includes(color)) {
          if (new RegExp(param.replace(/Color/i, "color"), "i").test(layerContext)) {
            dims[param] = color;
          }
        }
      }
    }
  });

  return newJson;
}

export { applyRules, createDefaultLayer, multiLayerFallbackParser };