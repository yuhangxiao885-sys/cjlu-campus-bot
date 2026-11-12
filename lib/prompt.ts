import { SYSTEM_PROMPT } from "@/prompts/config";
import { MAX_TOTAL_KNOWLEDGE_CHARS } from "./knowledge-constants";
import { getKnowledgePromptContext } from "./knowledge-store";

export function buildSystemPrompt(knowledgeContext?: string): string {
  const provided = knowledgeContext?.trim();
  const knowledge = provided
    ? provided.slice(0, MAX_TOTAL_KNOWLEDGE_CHARS)
    : getKnowledgePromptContext();
  const content =
    knowledge.trim() || "（本次未加载知识库，请直接依据你自身已有的知识回答。）";
  if (SYSTEM_PROMPT.includes("{{KNOWLEDGE_BASE}}")) {
    return SYSTEM_PROMPT.split("{{KNOWLEDGE_BASE}}").join(content);
  }
  return `${SYSTEM_PROMPT}\n\n<knowledge_base>\n${content}\n</knowledge_base>`;
}
