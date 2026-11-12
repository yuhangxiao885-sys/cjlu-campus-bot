import { getBuiltinKnowledge } from "./builtin-knowledge";
import {
  MAX_CHARS_PER_FILE,
  MAX_TOTAL_KNOWLEDGE_CHARS,
} from "./knowledge-constants";
import type { KnowledgeFileInfo, KnowledgeStatus } from "./types";

type StoredFile = KnowledgeFileInfo & { content: string };

type KnowledgeStore = {
  folderName: string | null;
  files: StoredFile[];
  totalChars: number;
  truncated: boolean;
  skippedFiles: string[];
  updatedAt: string | null;
};

type GlobalWithKnowledge = typeof globalThis & {
  __cimKnowledgeStore?: KnowledgeStore;
};

const EMPTY_STORE: KnowledgeStore = {
  folderName: null,
  files: [],
  totalChars: 0,
  truncated: false,
  skippedFiles: [],
  updatedAt: null,
};

const globals = globalThis as GlobalWithKnowledge;

function store(): KnowledgeStore {
  if (!globals.__cimKnowledgeStore) {
    globals.__cimKnowledgeStore = { ...EMPTY_STORE };
  }
  return globals.__cimKnowledgeStore;
}

function getBuiltinFile(): StoredFile | null {
  const builtin = getBuiltinKnowledge();
  if (!builtin) return null;

  return {
    path: builtin.path,
    content: builtin.content,
    chars: builtin.content.length,
    truncated: false,
    builtin: true,
  };
}

export function getKnowledgeStatus(): KnowledgeStatus {
  const current = store();
  const builtin = getBuiltinFile();
  const files = builtin ? [builtin, ...current.files] : current.files;

  return {
    ready: files.length > 0,
    folderName:
      current.folderName ?? (builtin ? "新生校园知识库（内置）" : null),
    files: files.map(({ path, chars, truncated, builtin: isBuiltin }) => ({
      path,
      chars,
      truncated,
      ...(isBuiltin ? { builtin: true } : {}),
    })),
    totalChars: files.reduce((sum, file) => sum + file.chars, 0),
    truncated: current.truncated,
    skippedFiles: [...current.skippedFiles],
    updatedAt: current.updatedAt,
    hasUploads: current.files.length > 0,
  };
}

export function replaceKnowledge(input: {
  folderName: string;
  files: Array<{ path: string; content: string }>;
  skippedFiles: string[];
}): KnowledgeStatus {
  const sorted = [...input.files].sort((a, b) =>
    a.path.localeCompare(b.path, "zh-CN"),
  );

  const files: StoredFile[] = [];
  const skippedFiles = [...input.skippedFiles];
  const builtinChars = getBuiltinFile()?.chars ?? 0;
  let remaining = Math.max(MAX_TOTAL_KNOWLEDGE_CHARS - builtinChars, 0);
  let truncated = false;

  for (const file of sorted) {
    if (remaining <= 0) {
      skippedFiles.push(`${file.path}（超出知识库总字数限制）`);
      truncated = true;
      continue;
    }

    const content = file.content.trim();
    if (!content) {
      skippedFiles.push(`${file.path}（文件内容为空）`);
      continue;
    }

    const limit = Math.min(MAX_CHARS_PER_FILE, remaining);
    const isTruncated = content.length > limit;
    const storedContent = isTruncated ? content.slice(0, limit) : content;

    files.push({
      path: file.path,
      content: storedContent,
      chars: storedContent.length,
      truncated: isTruncated,
    });

    remaining -= storedContent.length;
    if (isTruncated) truncated = true;
  }

  globals.__cimKnowledgeStore = {
    folderName: input.folderName,
    files,
    totalChars: files.reduce((sum, file) => sum + file.chars, 0),
    truncated,
    skippedFiles,
    updatedAt: new Date().toISOString(),
  };

  return getKnowledgeStatus();
}

export function clearKnowledge(): KnowledgeStatus {
  globals.__cimKnowledgeStore = { ...EMPTY_STORE };
  return getKnowledgeStatus();
}

/** 拼接到 System Prompt 的知识库正文。 */
export function getKnowledgePromptContext(): string {
  const current = store();
  const builtin = getBuiltinFile();
  const sections: string[] = [];

  if (builtin) {
    sections.push(`=== 文件：${builtin.path} ===\n${builtin.content}`);
  }

  for (const file of current.files) {
    sections.push(
      `=== 文件：${file.path}${file.truncated ? "（内容已截断）" : ""} ===\n${file.content}`,
    );
  }

  if (sections.length === 0) {
    return "（当前未加载额外知识库，请直接依据你自身已有的知识回答。）";
  }

  return sections.join("\n\n");
}
