"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  isSupportedFile,
} from "@/lib/knowledge-constants";
import type { KnowledgeStatus } from "@/lib/types";

export type KnowledgeUploadItem = {
  file: File;
  path: string;
};

function isKnowledgeStatus(value: unknown): value is KnowledgeStatus {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as KnowledgeStatus).files) &&
    typeof (value as KnowledgeStatus).totalChars === "number"
  );
}

const KNOWLEDGE_KEY = "cim-campus-assistant:knowledge:v1";

type StoredKnowledge = {
  status: KnowledgeStatus;
  promptContext: string;
};

function readPromptContext(value: unknown): string {
  return typeof value === "object" &&
    value !== null &&
    "promptContext" in value &&
    typeof (value as { promptContext?: unknown }).promptContext === "string"
    ? (value as { promptContext: string }).promptContext
    : "";
}

function readStoredKnowledge(): StoredKnowledge | null {
  try {
    const raw = window.localStorage.getItem(KNOWLEDGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !isKnowledgeStatus((parsed as StoredKnowledge).status) ||
      typeof (parsed as StoredKnowledge).promptContext !== "string"
    ) {
      return null;
    }
    return parsed as StoredKnowledge;
  } catch {
    return null;
  }
}

function writeStoredKnowledge(status: KnowledgeStatus, promptContext: string) {
  try {
    window.localStorage.setItem(
      KNOWLEDGE_KEY,
      JSON.stringify({ status, promptContext }),
    );
  } catch {
    // 浏览器存储空间不足时，知识库仅在当前页面会话中生效。
  }
}

function clearStoredKnowledge() {
  try {
    window.localStorage.removeItem(KNOWLEDGE_KEY);
  } catch {
    // 忽略隐私模式下的存储异常。
  }
}

export function useKnowledgeBase() {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [promptContext, setPromptContext] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const stored = readStoredKnowledge();
    if (stored) {
      setStatus(stored.status);
      setPromptContext(stored.promptContext);
    }

    async function load() {
      try {
        const response = await fetch("/api/knowledge", { cache: "no-store" });
        const data: unknown = await response.json();
        if (!active || !isKnowledgeStatus(data)) return;

        const serverReady = Boolean(data.ready);
        if (serverReady || !stored) {
          const context = readPromptContext(data);
          setStatus(data);
          setPromptContext(context);
          if (serverReady) writeStoredKnowledge(data, context);
          else clearStoredKnowledge();
        }
      } catch {
        if (active && !stored) {
          setError("无法获取知识库状态，请确认开发服务器正在运行。");
        }
      } finally {
        if (active) setInitializing(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const upload = useCallback(
    async (items: KnowledgeUploadItem[], folderName: string) => {
      if (uploading) return;

      setError(null);
      setNotice(null);

      const usable: KnowledgeUploadItem[] = [];
      let totalBytes = 0;
      let ignored = 0;

      for (const item of items) {
        if (
          !isSupportedFile(item.file.name) ||
          item.file.size > MAX_FILE_BYTES ||
          totalBytes + item.file.size > MAX_TOTAL_BYTES
        ) {
          ignored += 1;
          continue;
        }
        totalBytes += item.file.size;
        usable.push(item);
      }

      if (usable.length === 0) {
        setError(
          "没有可读取的文本文件。请选择包含 .md、.txt、.json、.csv 等文本资料的文件夹。",
        );
        return;
      }
      if (usable.length > MAX_FILES) {
        setError(`单次最多读取 ${MAX_FILES} 个文件，请缩小文件夹范围后重试。`);
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        for (const item of usable) {
          formData.append("files", item.file);
        }
        formData.append("paths", JSON.stringify(usable.map((item) => item.path)));
        formData.append("folderName", folderName);

        const response = await fetch("/api/knowledge", {
          method: "POST",
          body: formData,
        });
        const data: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : "知识库读取失败，请稍后重试。";
          throw new Error(message);
        }

        if (!isKnowledgeStatus(data)) {
          throw new Error("知识库返回了无法识别的数据。");
        }

        const context = readPromptContext(data);
        setStatus(data);
        setPromptContext(context);
        writeStoredKnowledge(data, context);
        if (ignored > 0) {
          setNotice(
            `已忽略 ${ignored} 个不支持、为空或超出大小限制的文件。`,
          );
        }
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "知识库读取失败，请稍后重试。",
        );
      } finally {
        setUploading(false);
      }
    },
    [uploading],
  );

  const clear = useCallback(async () => {
    if (clearing) return;
    setClearing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/knowledge", { method: "DELETE" });
      const data: unknown = await response.json();
      if (!response.ok || !isKnowledgeStatus(data)) {
        throw new Error("清空知识库失败，请稍后重试。");
      }
      const context = readPromptContext(data);
      setStatus(data);
      setPromptContext(context);
      if (data.ready) writeStoredKnowledge(data, context);
      else clearStoredKnowledge();
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : "清空知识库失败，请稍后重试。",
      );
    } finally {
      setClearing(false);
    }
  }, [clearing]);

  return {
    status,
    promptContext,
    initializing,
    uploading,
    clearing,
    error,
    notice,
    upload,
    clear,
  };
}
