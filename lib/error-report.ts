export interface StoredError {
  message: string;
  stack?: string;
  at: string;
  scope: string;
}

const STORAGE_KEY = "cyberfate-errors";
const MAX_ERRORS = 20;

/**
 * 本地错误日志：只记录 message / stack / 时间，不含任何出生资料。
 * 站点没有后端，错误默认只留在此浏览器；外部监控可以通过
 * window.__cyberfateErrorSink 接管（例如自建 Sentry 中继）。
 */
export function recordError(error: unknown, scope: string) {
  if (typeof window === "undefined") return;
  const entry: StoredError = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
    at: new Date().toISOString(),
    scope,
  };
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as StoredError[];
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, entry].slice(-MAX_ERRORS)));
  } catch {
    // 日志不可用时静默，不影响主流程。
  }
  const sink = (window as unknown as { __cyberfateErrorSink?: (error: unknown, scope: string) => void }).__cyberfateErrorSink;
  try { sink?.(error, scope); } catch { /* 外部接管方出错不影响应用 */ }
}

export function readStoredErrors(): StoredError[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as StoredError[];
    return Array.isArray(value) ? value.filter((item) => item && typeof item.message === "string" && typeof item.at === "string") : [];
  } catch {
    return [];
  }
}

/** 供用户复制诊断信息的纯文本；不含命盘内容。 */
export function buildDiagnosticsText(): string {
  const errors = readStoredErrors();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  const lines = [
    "CYBERFATE 诊断信息",
    `时间：${new Date().toISOString()}`,
    `环境：${ua}`,
    `算法版本可用，错误 ${errors.length} 条（不含任何命盘数据）：`,
    ...errors.map((item, index) => `${index + 1}. [${item.scope}] ${item.at} ${item.message}`),
  ];
  return lines.join("\n");
}

/** 在应用启动时挂载全局错误兜底；幂等，可重复调用。 */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined" || (window as unknown as { __cyberfateHandlersInstalled?: boolean }).__cyberfateHandlersInstalled) return;
  (window as unknown as { __cyberfateHandlersInstalled?: boolean }).__cyberfateHandlersInstalled = true;
  window.addEventListener("error", (event) => {
    recordError(event.error ?? event.message, "window");
  });
  window.addEventListener("unhandledrejection", (event) => {
    recordError(event.reason, "promise");
  });
}
