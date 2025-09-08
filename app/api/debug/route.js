import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY ? "✅ set" : "❌ missing",
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || "❌ missing",
    AZURE_OPENAI_DEPLOYMENT_GPT4: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4 || "❌ missing",
  });
}
