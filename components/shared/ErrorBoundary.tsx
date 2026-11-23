"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { buildDiagnosticsText, recordError } from "@/lib/error-report";
import { Icon } from "@/components/shared/Icon";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** 全局错误边界：渲染崩溃时给出友好出口，本地档案仍然完好。 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordError(error, `render:${info.componentStack?.trim().split("\n")[0] ?? "unknown"}`);
  }

  async copyDiagnostics() {
    const text = buildDiagnosticsText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <div className="error-fallback" role="alert">
            <span className="eyebrow">CYBERFATE · 意外中断</span>
            <h1>这一页没能渲染出来</h1>
            <p>你的命盘、档案与观测记录都还保存在浏览器里，没有丢失。可以重试加载；若反复出现，请复制诊断信息反馈给开发者。</p>
            <div className="error-actions">
              <button onClick={() => window.location.reload()}>重新加载</button>
              <button onClick={() => this.copyDiagnostics()}>复制诊断信息</button>
            </div>
            <p className="fine-print"><Icon name="compass" size={14} /> 诊断信息只包含错误消息与时间，不含出生资料。</p>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
