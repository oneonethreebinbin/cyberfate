"use client";

import { Icon } from "@/components/shared/Icon";
import { INTENT_OPTIONS, type ObservationIntent } from "@/components/types";

export function OnboardingView({ intent, onIntentChange, onStart, onSample }: {
  intent: ObservationIntent;
  onIntentChange: (intent: ObservationIntent) => void;
  onStart: () => void;
  onSample: () => void;
}) {
  return (
    <div className="onboarding-view">
      <section className="onboarding-hero">
        <div className="onboarding-copy">
          <span className="eyebrow">CYBERFATE · 初次观测</span>
          <h1>从一个问题，<br />开始观照</h1>
          <p>先说此刻关心的事。复杂盘面会收束成三条可核对的观察，依据与边界留在深处，等你需要时再展开。</p>
          <div className="intent-grid" role="radiogroup" aria-label="选择观察主题">
            {INTENT_OPTIONS.map((option, index) => (
              <button
                type="button"
                role="radio"
                aria-checked={intent === option.id}
                className={intent === option.id ? "intent-card active" : "intent-card"}
                key={option.id}
                onClick={() => onIntentChange(option.id)}
              >
                <small>0{index + 1} · {option.label}</small>
                <strong>{option.title}</strong>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>
          <div className="onboarding-actions">
            <button className="onboarding-primary" onClick={onStart}>填写出生资料 <Icon name="arrow" /></button>
            <button className="onboarding-secondary" onClick={onSample}>先看示例结果</button>
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
