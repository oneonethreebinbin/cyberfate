"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { correctSolarTime, getTimeBranch } from "@/lib/solar-time";
import type { ChartInsight } from "@/lib/insights";
import type { BirthProfile, FateChart, Gender } from "@/lib/types";
import { DateTimeField } from "@/components/DateTimeField";
import { CITY_OPTIONS, cityIdForLongitude } from "@/lib/locations";
import {
  createObservationRecord,
  isObservationRecord,
  questionForInsight,
  readObservationRecords,
  writeObservationRecords,
  type ObservationRecord,
  type ObservationSource,
} from "@/lib/observations";
import { ALGORITHM_VERSION, trackLocalEvent } from "@/lib/product";
import { downloadJson, isBirthProfile, isValidBirthDate, isValidTime, localDateAfter, localDateValue } from "@/lib/birth";
import { installGlobalErrorHandlers } from "@/lib/error-report";
import { Icon } from "@/components/shared/Icon";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import {
  handleTabArrow,
  INITIAL_PROFILE,
  SAMPLE_PROFILE,
  TAB_ITEMS,
  type ExpertMode,
  type ExploreMode,
  type ObservationIntent,
  type Tab,
  type ViewMode,
} from "@/components/types";
import { OnboardingView } from "@/components/views/OnboardingView";
import { Overview, UnknownTimeOverview } from "@/components/views/OverviewView";
import { ExplorationView } from "@/components/views/ExplorationView";
import { ExpertView } from "@/components/views/ExpertView";

function FeatureLoading() {
  return <section className="feature-loading" role="status">正在准备这一部分…</section>;
}

const ObservationView = dynamic(() => import("@/components/ObservationView").then((mod) => mod.ObservationView), { loading: FeatureLoading });

export function CyberfateApp() {
  const [tab, setTab] = useState<Tab>("overview");
  const [expertMode, setExpertMode] = useState<ExpertMode>("bazi");
  const [exploreMode, setExploreMode] = useState<ExploreMode>("self");
  const [intent, setIntent] = useState<ObservationIntent>("self");
  const [hasResult, setHasResult] = useState(false);
  const [cityId, setCityId] = useState("");
  const [genderSelected, setGenderSelected] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [profile, setProfile] = useState<BirthProfile>(INITIAL_PROFILE);
  const [chart, setChart] = useState<FateChart | null>(null);
  const [history, setHistory] = useState<BirthProfile[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeTimerRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    installGlobalErrorHandlers();
    try {
      const stored = JSON.parse(localStorage.getItem("cyberfate-history") ?? "[]");
      setHistory(Array.isArray(stored) ? stored.filter(isBirthProfile).slice(0, 8) : []);
    } catch {
      setHistory([]);
    }
    setObservations(readObservationRecords());
  }, []);

  useEffect(() => () => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
  }, []);

  function flashNotice(message: string, duration = 2600) {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice("");
      noticeTimerRef.current = null;
    }, duration);
  }

  function holdNotice(message: string) {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = null;
    setNotice(message);
  }

  const draftHasDateTime = isValidBirthDate(profile.date) && (profile.timeKnown === false || isValidTime(profile.time));
  const draftReady = draftHasDateTime && genderSelected && Boolean(cityId);
  const timeBranch = useMemo(() => getTimeBranch(profile.time), [profile.time]);
  const preview = useMemo(() => draftHasDateTime ? correctSolarTime({ ...profile, time: profile.timeKnown === false ? "12:00" : profile.time }) : null, [draftHasDateTime, profile]);
  const previewCorrection = preview?.detail;
  const previewBranch = useMemo(() => preview ? getTimeBranch(`${preview.date.getHours()}:00`) : "", [preview]);

  function updateProfile<K extends keyof BirthProfile>(key: K, value: BirthProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function navigateToTab(nextTab: Tab, nextMode?: ViewMode) {
    if (nextTab === "expert" && (nextMode === "bazi" || nextMode === "ziwei")) setExpertMode(nextMode);
    if (nextTab === "explore" && (nextMode === "self" || nextMode === "timing" || nextMode === "relationship")) setExploreMode(nextMode);
    setTab(nextTab);
    window.requestAnimationFrame(() => {
      const stage = document.querySelector<HTMLElement>(".content-stage");
      const topbar = document.querySelector<HTMLElement>(".topbar");
      if (stage) {
        const top = stage.getBoundingClientRect().top + window.scrollY - (topbar?.offsetHeight ?? 0);
        window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "auto" });
      }
      const heading = stage?.querySelector<HTMLElement>("h1");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
  }

  function updateCity(nextCityId: string) {
    setCityId(nextCityId);
    const city = CITY_OPTIONS.find((item) => item.id === nextCityId);
    if (city) updateProfile("longitude", city.longitude);
  }

  function startInput() {
    setRailCollapsed(false);
    setMobileControlsOpen(true);
    window.requestAnimationFrame(() => {
      const firstField = document.querySelector<HTMLElement>("#birth-controls .picker-trigger");
      firstField?.focus({ preventScroll: true });
      document.querySelector<HTMLElement>(".control-rail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function startPersonalInput() {
    setProfile({ ...INITIAL_PROFILE, createdAt: new Date().toISOString() });
    setCityId("");
    setGenderSelected(false);
    setChart(null);
    setHasResult(false);
    setTab("overview");
    startInput();
  }

  async function showSample() {
    setIsCalculating(true);
    try {
      const { createFateChart } = await import("@/lib/engines");
      setProfile(SAMPLE_PROFILE);
      setChart(createFateChart(SAMPLE_PROFILE));
      setCityId("beijing");
      setGenderSelected(true);
      setHasResult(true);
      setRailCollapsed(true);
      setMobileControlsOpen(false);
      navigateToTab("overview");
      trackLocalEvent("sample_opened");
      flashNotice("当前展示的是示例数据，不是你的命盘", 3200);
    } catch {
      holdNotice("示例命盘加载失败，请刷新后重试");
    } finally {
      setIsCalculating(false);
    }
  }

  async function generate() {
    try {
      if (!isValidBirthDate(profile.date) || (profile.timeKnown !== false && !isValidTime(profile.time))) {
        throw new Error(profile.timeKnown === false ? "请填写有效的出生日期，且不能晚于今天" : "请填写有效的出生日期和时间；出生日期不能晚于今天");
      }
      if (!genderSelected) throw new Error("请选择传统排盘使用的男命或女命口径");
      if (!cityId) throw new Error("请选择出生城市；当前仅支持中国标准时间（UTC+8）");
      if (!Number.isFinite(profile.longitude) || profile.longitude < 73 || profile.longitude > 135) {
        throw new Error("出生地经度请输入 73°–135° 之间的数值");
      }
      setIsCalculating(true);
      const next: BirthProfile = { ...profile, time: profile.timeKnown === false ? "12:00" : profile.time, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      const { createFateChart } = await import("@/lib/engines");
      const result = createFateChart(next);
      setChart(result);
      setProfile(next);
      setHasResult(true);
      const records = [next, ...history.filter((item) => !(item.date === next.date && item.time === next.time && item.gender === next.gender))].slice(0, 8);
      setHistory(records);
      try { localStorage.setItem("cyberfate-history", JSON.stringify(records)); } catch { /* 会话内仍可使用 */ }
      setExploreMode(intent);
      navigateToTab(next.timeKnown === false ? "overview" : intent === "self" ? "overview" : "explore", intent);
      setMobileControlsOpen(false);
      setRailCollapsed(true);
      trackLocalEvent("chart_generated", { intent, timeKnown: next.timeKnown !== false });
      flashNotice(next.timeKnown === false ? "已生成三柱有限观察；补充时辰可展开完整盘面" : "已根据你的资料生成命盘", 3200);
    } catch (error) {
      holdNotice(error instanceof Error ? error.message : "生成失败，请检查出生资料");
    } finally {
      setIsCalculating(false);
    }
  }

  async function loadProfile(item: BirthProfile) {
    setIsCalculating(true);
    try {
      const { createFateChart } = await import("@/lib/engines");
      setProfile(item);
      setChart(createFateChart(item));
      setHasResult(true);
      setGenderSelected(true);
      setCityId(cityIdForLongitude(item.longitude));
      setHistoryOpen(false);
      setPendingDeleteId(null);
      setConfirmClear(false);
      setRailCollapsed(true);
      navigateToTab("overview");
      setMobileControlsOpen(false);
    } catch {
      holdNotice("此档案无法读取，请检查备份版本或出生资料");
    } finally {
      setIsCalculating(false);
    }
  }

  function closeHistory() {
    setHistoryOpen(false);
    setPendingDeleteId(null);
    setConfirmClear(false);
  }

  function removeProfile(id: string) {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      setConfirmClear(false);
      return;
    }
    const records = history.filter((item) => item.id !== id);
    setHistory(records);
    try { localStorage.setItem("cyberfate-history", JSON.stringify(records)); } catch { /* 会话内仍可删除 */ }
    setPendingDeleteId(null);
    flashNotice("档案已删除", 2200);
  }

  function clearHistory() {
    if (!confirmClear) {
      setConfirmClear(true);
      setPendingDeleteId(null);
      return;
    }
    localStorage.removeItem("cyberfate-history");
    setHistory([]);
    setConfirmClear(false);
    flashNotice("已清空全部档案", 2200);
  }

  function exportChart() {
    if (!hasResult || !chart) return;
    downloadJson(`cyberfate-${chart.profile.name || chart.profile.date}.json`, {
      format: "cyberfate-chart",
      version: 1,
      algorithmVersion: ALGORITHM_VERSION,
      exportedAt: new Date().toISOString(),
      chart,
      observations: observations.filter((record) => record.profileId === chart.profile.id),
    });
    flashNotice("已导出当前命盘 JSON，请妥善保存", 2800);
  }

  function exportBackup() {
    downloadJson(`cyberfate-backup-${localDateValue()}.json`, {
      format: "cyberfate-backup",
      version: 1,
      algorithmVersion: ALGORITHM_VERSION,
      exportedAt: new Date().toISOString(),
      profiles: history,
      observations,
    });
    flashNotice("已导出全部档案与观测记录", 2600);
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("备份文件超过 5MB，请检查是否选择了正确文件");
      const value = JSON.parse(await file.text()) as { format?: string; version?: number; profiles?: unknown[]; observations?: unknown[] };
      if (value.format !== "cyberfate-backup" || value.version !== 1 || !Array.isArray(value.profiles) || !Array.isArray(value.observations)) {
        throw new Error("请选择由本应用导出的完整备份文件");
      }
      const importedProfiles = value.profiles.filter(isBirthProfile);
      const importedObservations = value.observations.filter(isObservationRecord);
      if (!importedProfiles.length && !importedObservations.length) throw new Error("备份中没有可恢复的档案或观测记录");
      const mergedProfiles = [...importedProfiles, ...history.filter((item) => !importedProfiles.some((incoming) => incoming.id === item.id))].slice(0, 8);
      const mergedObservations = [...importedObservations, ...observations.filter((item) => !importedObservations.some((incoming) => incoming.id === item.id))];
      setHistory(mergedProfiles);
      updateObservations(mergedObservations);
      localStorage.setItem("cyberfate-history", JSON.stringify(mergedProfiles));
      flashNotice(`已恢复 ${importedProfiles.length} 个档案与 ${importedObservations.length} 条观测`, 3400);
    } catch (error) {
      holdNotice(error instanceof Error ? error.message : "备份读取失败，请检查文件格式");
    }
  }

  function updateObservations(records: ObservationRecord[]) {
    setObservations(records);
    writeObservationRecords(records);
  }

  function saveInsight(insight: ChartInsight) {
    saveProductObservation("insight", insight.id, insight.title, questionForInsight(insight.id));
  }

  function saveProductObservation(source: ObservationSource, sourceId: string, title: string, question: string, observedOn = new Date().toISOString().slice(0, 10)) {
    if (!chart) return;
    if (observations.some((record) => record.profileId === chart.profile.id && record.sourceId === sourceId)) return;
    const record = createObservationRecord({
      profileId: chart.profile.id,
      profileName: chart.profile.name || "未命名命盘",
      source,
      sourceId,
      title,
      question,
      observedOn,
      reviewOn: localDateAfter(30),
    });
    updateObservations([record, ...observations]);
    trackLocalEvent("observation_saved", { source });
    flashNotice("问题已加入观测簿，日后可回来核对", 2600);
  }

  function saveLimitedObservation(sourceId: string, title: string, question: string) {
    saveProductObservation("insight", sourceId, title, question);
  }

  function requestKnownTime() {
    updateProfile("timeKnown", true);
    updateProfile("time", "");
    setRailCollapsed(false);
    setMobileControlsOpen(true);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".control-rail")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <ErrorBoundary>
      <main className="app-shell">
        <header className="topbar">
          <button className="brand" onClick={() => hasResult && navigateToTab("overview")} aria-label={hasResult ? "返回总览" : "Cyberfate 首页"}>
            <span className="brand-mark"><i /><b>命</b></span>
            <span><strong>CYBERFATE</strong><small>数字命理观星台</small></span>
          </button>
          <div className="top-actions">
            <button onClick={() => historyOpen ? closeHistory() : setHistoryOpen(true)}><Icon name="history" />档案</button>
            <button onClick={exportChart} disabled={!hasResult} title={hasResult ? "导出当前命盘" : "生成命盘后可导出"}><Icon name="download" />导出</button>
          </div>
        </header>

        <div className={`workspace ${hasResult ? "has-result" : ""} ${railCollapsed ? "rail-collapsed" : ""}`}>
          <aside className="control-rail">
            {hasResult && railCollapsed && <button className="desktop-rail-toggle" aria-expanded="false" aria-controls="birth-controls" onClick={() => setRailCollapsed(false)}><Icon name="compass" /><span>资料</span></button>}
            <button className="mobile-rail-toggle" aria-expanded={mobileControlsOpen} aria-controls="birth-controls" onClick={() => setMobileControlsOpen((value) => !value)}>
              <span><small>{hasResult ? "当前档案" : "准备起盘"}</small><strong>{hasResult ? (chart?.profile.name || "未命名命盘") : (profile.name || "填写出生资料")}</strong><em>{hasResult ? chart?.profile.date : (profile.date || "尚未选择日期")} · {(hasResult ? chart?.profile.timeKnown : profile.timeKnown) === false ? "时辰未知" : (hasResult ? chart?.profile.time : (profile.time || "尚未选择时间"))}</em></span>
              <b>{mobileControlsOpen ? "收起资料" : hasResult ? "修改资料" : "开始填写"}</b>
            </button>
            <div className={`rail-body ${mobileControlsOpen ? "mobile-open" : ""}`} id="birth-controls">
              <div className="rail-heading"><div><span>出生资料</span><h2>生成观察</h2></div>{hasResult && <button className="rail-collapse-button" onClick={() => setRailCollapsed(true)} aria-label="收起出生资料">收起</button>}<p>只在浏览器本地计算，不上传生辰。</p></div>
              <div className="form-stack">
                <label><span>档案名称 <small>选填</small></span><input value={profile.name} onChange={(event) => updateProfile("name", event.target.value)} placeholder="例如：我的命盘" /></label>
                <div className="field-pair">
                  <DateTimeField label="公历日期" type="date" value={profile.date} max={localDateValue()} onChange={(value) => updateProfile("date", value)} />
                  {profile.timeKnown !== false ? <DateTimeField label="出生时间" type="time" value={profile.time} onChange={(value) => updateProfile("time", value)} /> : <div className="unknown-time-placeholder"><span>出生时间</span><b>暂不知道</b><small>先按正午生成有限观察</small></div>}
                </div>
                <button
                  type="button"
                  className={`time-known-link ${profile.timeKnown === false ? "active" : ""}`}
                  onClick={() => {
                    if (profile.timeKnown === false) { updateProfile("timeKnown", true); updateProfile("time", ""); }
                    else {
                      updateProfile("timeKnown", false);
                      updateProfile("time", "12:00");
                    }
                  }}
                >
                  <span>{profile.timeKnown === false ? "时辰暂未知" : "不知道准确时间？"}</span>
                  <small>{profile.timeKnown === false ? "点击补充准确时间" : "先按年、月、日三柱观察"}</small>
                </button>
                <fieldset><legend>传统排盘口径 <small>用于大运顺逆</small></legend><div className="segmented">{(["男", "女"] as Gender[]).map((gender) => <button type="button" aria-pressed={genderSelected && profile.gender === gender} className={genderSelected && profile.gender === gender ? "active" : ""} key={gender} onClick={() => { updateProfile("gender", gender); setGenderSelected(true); }}>{gender}命</button>)}</div></fieldset>
                <label><span>出生城市</span><select className="place-select" value={cityId} onChange={(event) => updateCity(event.target.value)}><option value="" disabled>请选择城市</option>{CITY_OPTIONS.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}<option value="custom">其他 / 手动经度</option></select></label>
                <p className="timezone-scope" role="note"><Icon name="info" size={14} /> 当前仅支持按中国标准时间（UTC+8）记录的出生时间；海外时区暂不适用。</p>
                <details className="advanced-location" open={cityId === "custom"}>
                  <summary>高级：手动输入经度</summary>
                  <label><span>出生地经度 <small>东经</small></span><div className="longitude-input"><input type="number" min="73" max="135" step="0.1" value={profile.longitude} onChange={(event) => { setCityId("custom"); updateProfile("longitude", Number(event.target.value)); }} /><b>°</b></div></label>
                </details>
                {profile.timeKnown !== false && <label className="toggle-row"><span><b>真太阳时校正</b><small>经度差 + 均时差</small></span><input type="checkbox" checked={profile.useTrueSolarTime} onChange={(event) => updateProfile("useTrueSolarTime", event.target.checked)} /><i /></label>}
              </div>
              <div className={`correction-readout ${profile.timeKnown === false ? "unknown" : ""}`}>
                <span>{profile.timeKnown === false ? "当前精度" : "校正预览"}</span><b>{profile.timeKnown === false && draftHasDateTime ? "三柱" : !previewCorrection ? "待填写" : profile.useTrueSolarTime ? `${previewCorrection.minutes >= 0 ? "+" : ""}${previewCorrection.minutes} min` : "OFF"}</b>
                <small>{!draftHasDateTime ? "填写日期与时间后显示校正结果" : profile.timeKnown === false ? "时柱与紫微盘暂不作为结论" : profile.useTrueSolarTime ? `校正后 ${previewBranch}时` : `${timeBranch}时`} {profile.timeKnown !== false && previewCorrection && `· 基准东经 120°${previewCorrection.dstMinutes !== 0 ? ` · 夏令时还原 ${previewCorrection.dstMinutes} min` : ""}`}</small>
              </div>
              <button className="generate-button" disabled={!draftReady || isCalculating} onClick={generate}><Icon name="spark" /><span>{isCalculating ? "正在计算" : "生成我的观察"}<small>{draftReady ? "依当前资料起盘" : "请先完成必填资料"}</small></span><Icon name="arrow" /></button>
              <p className="privacy-note"><Icon name="compass" size={15} /> 本地计算 · 生辰不会上传</p>
            </div>
          </aside>

          <section className="content-stage">
            {hasResult && chart?.profile.id === "sample" && <div className="sample-mode-banner" role="status"><b>示例数据</b><span>当前内容用于体验功能，不代表你的命盘。</span><button onClick={startPersonalInput}>填写我的资料</button></div>}
            {hasResult && <nav className="tabbar" role="tablist" aria-label="命盘视图">
              {TAB_ITEMS.map((item) => <button id={`view-tab-${item.id}`} aria-controls="view-panel" tabIndex={tab === item.id ? 0 : -1} role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "active" : ""} onKeyDown={(event) => handleTabArrow(event, TAB_ITEMS.map((entry) => entry.id), tab, navigateToTab, "view-tab-")} onClick={() => navigateToTab(item.id)}><span>{item.label}</span><small>{item.hint}</small></button>)}
            </nav>}
            <div className="view-container" id="view-panel" role={hasResult ? "tabpanel" : undefined} aria-labelledby={hasResult ? `view-tab-${tab}` : undefined}>
              {!hasResult && <OnboardingView intent={intent} onIntentChange={setIntent} onStart={startInput} onSample={showSample} />}
              {hasResult && chart && tab === "overview" && (chart.profile.timeKnown === false ? <UnknownTimeOverview chart={chart} records={observations} onSave={saveLimitedObservation} onAddTime={requestKnownTime} /> : <Overview chart={chart} intent={intent} records={observations} onSaveInsight={saveInsight} onNavigate={navigateToTab} />)}
              {hasResult && chart && tab === "explore" && <ExplorationView chart={chart} mode={exploreMode} records={observations} onModeChange={setExploreMode} onSaveInsight={saveInsight} onSaveObservation={saveProductObservation} onNavigate={navigateToTab} />}
              {hasResult && chart && tab === "observations" && <ObservationView chart={chart} records={observations} onChange={updateObservations} onExplore={() => navigateToTab("overview")} />}
              {hasResult && chart && tab === "expert" && <ExpertView chart={chart} mode={expertMode} onModeChange={setExpertMode} />}
              {isCalculating && !chart && <FeatureLoading />}
            </div>
          </section>
        </div>

        {historyOpen && <div className="history-popover">
          <header><div><span>LOCAL ARCHIVE · {history.length}/8</span><h2>本地档案</h2></div><button onClick={closeHistory} aria-label="关闭本地档案">×</button></header>
          <div className="history-backup-actions">
            <button onClick={exportBackup} disabled={!history.length && !observations.length}>备份全部</button>
            <button onClick={() => importInputRef.current?.click()}>恢复备份</button>
            <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importBackup} />
            <p>备份包含全部本地档案与观测记录；恢复时会按记录编号合并，不覆盖同编号数据。</p>
          </div>
          {history.length ? <>
            <div className="history-list">{history.map((item) => <div className="history-item" key={item.id}>
              <button className="history-load" onClick={() => loadProfile(item)}><span><b>{item.name || "未命名"}</b><small>{item.date} · {item.timeKnown === false ? "时辰未知" : item.time} · {item.gender}命</small></span><Icon name="arrow" /></button>
              <button className={`history-delete ${pendingDeleteId === item.id ? "confirm" : ""}`} onClick={() => removeProfile(item.id)} aria-label={`${pendingDeleteId === item.id ? "确认删除" : "删除"}${item.name || "未命名档案"}`}>{pendingDeleteId === item.id ? "确认" : "删除"}</button>
            </div>)}</div>
            <div className="history-footer"><p>档案仅保存在当前浏览器，请定期备份。</p><button className={confirmClear ? "confirm" : ""} onClick={clearHistory}>{confirmClear ? "再次点击确认清空" : "清空全部"}</button></div>
          </> : <div className="empty-history"><Icon name="history" size={28} /><p>生成命盘后会自动保存在这里，也可以从备份恢复。</p></div>}
        </div>}
        {historyOpen && <button className="popover-backdrop" aria-label="关闭档案" onClick={closeHistory} />}
        {notice && <div className="toast" role="status" aria-live="polite"><Icon name="spark" size={15} />{notice}</div>}
        <footer className="site-footer">
          <span>{ALGORITHM_VERSION} · LOCAL-FIRST</span>
          <p>观星台上无神通，只有历法与规则。所示皆传统之学，供文化研究与自我省察，不构成医疗、法律、财务或人生重大决策之依据。</p>
          <nav className="footer-links" aria-label="站内页面">
            <a href="/terms">术语词典</a>
          </nav>
        </footer>
      </main>
    </ErrorBoundary>
  );
}
