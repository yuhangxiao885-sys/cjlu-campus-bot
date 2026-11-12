import { readFileSync } from "node:fs";
import { join } from "node:path";

const KNOWLEDGE_FILE = join("knowledge", "cjlu-guide.md");
const KNOWLEDGE_PATH = "内置/中国计量大学新生校园知识库.md";

type BuiltinKnowledge = {
  path: string;
  content: string;
};

let cached: BuiltinKnowledge | null | undefined;

export function getBuiltinKnowledge(): BuiltinKnowledge | null {
  if (cached !== undefined) return cached;

  try {
    const content = readFileSync(join(process.cwd(), KNOWLEDGE_FILE), "utf8").trim();
    cached = content ? { path: KNOWLEDGE_PATH, content } : null;
  } catch {
    cached = null;
  }

  return cached;
}
