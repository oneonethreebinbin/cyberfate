"use client";

import { useEffect, useRef, useState } from "react";

export function PrivacyConfirmDialog({ title, description, confirmLabel, onCancel, onConfirm }: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmingRef = useRef(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled)")];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus({ preventScroll: true });
    };
  }, [onCancel]);

  function confirmOnce() {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirming(true);
    onConfirm();
  }

  return <>
    <button className="privacy-dialog-backdrop" aria-label="取消导出" onClick={onCancel} />
    <div className="privacy-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="privacy-dialog-title" aria-describedby="privacy-dialog-description">
      <span>LOCAL EXPORT · 未加密文件</span>
      <h2 id="privacy-dialog-title">{title}</h2>
      <p id="privacy-dialog-description">{description}</p>
      <div className="privacy-dialog-actions">
        <button ref={cancelRef} onClick={onCancel}>取消</button>
        <button className="primary" disabled={confirming} onClick={confirmOnce}>{confirming ? "正在准备" : confirmLabel}</button>
      </div>
    </div>
  </>;
}
