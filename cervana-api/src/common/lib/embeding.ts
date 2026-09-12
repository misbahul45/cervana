import axios from "axios";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

function clearText(text: string) {
  return text
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 250,
});

// =====================
// GEMINI EMBEDDING
// =====================
async function getEmbedding(text: string): Promise<number[]> {
  const API_KEY = process.env.GEMINI_API_KEY;
  const MODEL = "models/embedding-001";

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/${MODEL}:embedContent?key=${API_KEY}`,
    {
      model: MODEL,
      content: {
        parts: [{ text }],
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.embedding.values;
}


// =====================
// SPLIT & EMBED
// =====================
export async function splitAndEmbedding(
  text: string
): Promise<{ chunkText: string; embedding: number[] }[]> {
  const docs = await textSplitter.splitText(clearText(text));

  const results = await Promise.all(
    docs.map(async (chunk) => {
      const embedding = await getEmbedding(chunk);
      return { chunkText: chunk, embedding };
    })
  );

  return results;
}
