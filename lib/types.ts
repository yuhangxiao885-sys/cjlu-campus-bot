export type KnowledgeFileInfo = {
  path: string;
  chars: number;
  truncated: boolean;
  builtin?: boolean;
};

export type KnowledgeStatus = {
  ready: boolean;
  folderName: string | null;
  files: KnowledgeFileInfo[];
  totalChars: number;
  truncated: boolean;
  skippedFiles: string[];
  updatedAt: string | null;
  hasUploads: boolean;
};

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  isError?: boolean;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export type ApiMessage = {
  role: ChatRole;
  content: string;
};
