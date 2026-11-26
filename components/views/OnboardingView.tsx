"use client";

import { Icon } from "@/components/shared/Icon";
import { INTENT_OPTIONS, type ObservationIntent } from "@/components/types";

export function OnboardingView({ intent, onIntentChange, onStart, onSample }: {
  intent: ObservationIntent;
  onIntentChange: (intent: ObservationIntent) => void;
  onStart: () => void;
  onSample: () => void;
}) {
  function handleIntentKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? INTENT_OPTIONS.length - 1
        : (index + direction + INTENT_OPTIONS.length) % INTENT_OPTIONS.length;
    const next = INTENT_OPTIONS[nextIndex];
    onIntentChange(next.id);
    window.requestAnimationFrame(() => document.getElementById(`intent-${next.id}`)?.focus());
  }

  return (
    <div className="onboarding-view">
      <section className="onboarding-hero">
        <div className="onboarding-copy">
          <span className="eyebrow">CYBERFATE · 初次观测</span>
          <h1>此刻，你最想<br />看清什么？</h1>
          <p>先选一个真实问题。复杂盘面会收束成容易读懂、能够核对的观察，依据与边界则留在深处。</p>
          <div className="intent-grid" role="radiogroup" aria-label="选择观察主题">
            {INTENT_OPTIONS.map((option, index) => (
              <button
                type="button"
                id={`intent-${option.id}`}
                role="radio"
                aria-checked={intent === option.id}
                tabIndex={intent === option.id ? 0 : -1}
                className={intent === option.id ? "intent-card active" : "intent-card"}
                key={option.id}
                onClick={() => onIntentChange(option.id)}
                onKeyDown={(event) => handleIntentKey(event, index)}
              >
                <small>0{index + 1} · {option.label}</small>
                <strong>{option.title}</strong>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>
          <p className="onboarding-outcome"><b>你将得到</b> 一句当前主题、三条可核对线索，以及一个带回现实的复盘问题。</p>
          <div className="onboarding-actions">
            <button className="onboarding-primary" onClick={onStart}>填资料，生成我的观察 <Icon name="arrow" /></button>
            <button className="onboarding-secondary" onClick={onSample}>先看示例怎么读</button>
          </div>
          <p className="onboarding-privacy"><Icon name="compass" size={15} /> 所有排盘都在你的浏览器内完成，生辰不会上传。</p>
        </div>
        <div className="onboarding-symbol" aria-hidden="true">
          <div className="symbol-orbit orbit-a"><i /></div>
          <div className="symbol-orbit orbit-b"><i /></div>
          <span>问</span>
          <small>所问不同<br />看盘次序也不同</small>
        </div>
      </section>
      <div className="onboarding-footline" aria-label="产品原则">
        <span><b>本地</b> 生辰不上传</span><i />
        <span><b>可查</b> 判断有依据</span><i />
        <span><b>可复盘</b> 现实会回答</span>
      </div>
    </div>
  );
}
