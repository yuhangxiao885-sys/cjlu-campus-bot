/** 前后端共用的知识库限制与支持格式。 */
export const MAX_TOTAL_KNOWLEDGE_CHARS = 60_000;
export const MAX_CHARS_PER_FILE = 20_000;
export const MAX_FILES = 500;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export const SUPPORTED_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".mdx",
  ".json",
  ".csv",
  ".tsv",
  ".html",
  ".htm",
  ".xml",
  ".yaml",
  ".yml",
  ".log",
  ".rst",
  ".ini",
  ".conf",
] as const;

export function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index === -1 ? "" : fileName.slice(index).toLowerCase();
}

export function isSupportedFile(fileName: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(
    getFileExtension(fileName),
  );
}
