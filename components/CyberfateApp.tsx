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
  type ObservationDraft,
  type ObservationRecord,
  type ObservationSource,
} from "@/lib/observations";
import { ALGORITHM_VERSION, trackLocalEvent } from "@/lib/product";
import { downloadJson, isBirthProfile, isSameBirthProfileInput, isValidBirthDate, isValidTime, localDateAfter, localDateValue } from "@/lib/birth";
import {
  normalizeRelationshipNotesBackupEntries,
  readAllRelationshipTimelineNotes,
  removeRelationshipTimelineNotes,
  RELATIONSHIP_NOTES_CHANGED_EVENT,
  restoreRelationshipTimelineNotes,
  type RelationshipNotesBackupEntry,
} from "@/lib/relationship-notes";
import { clearCyberfateLocalData } from "@/lib/local-data";
import { installGlobalErrorHandlers } from "@/lib/error-report";
import { Icon } from "@/components/shared/Icon";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { PrivacyConfirmDialog } from "@/components/shared/PrivacyConfirmDialog";
import {
  handleTabArrow,
  INITIAL_PROFILE,
  SAMPLE_PROFILE,
  TAB_ITEMS,
  type ExpertMode,
  type ExploreMode,
  type ObservationIntent,
  type ReadingDepth,
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

type ExportKind = "chart" | "backup";

export function CyberfateApp() {
  const [tab, setTab] = useState<Tab>("overview");
  const [expertMode, setExpertMode] = useState<ExpertMode>("bazi");
  const [exploreMode, setExploreMode] = useState<ExploreMode>("self");
  const [intent, setIntent] = useState<ObservationIntent>("self");
  const [readingDepth, setReadingDepth] = useState<ReadingDepth>("brief");
  const [hasResult, setHasResult] = useState(false);
  const [cityId, setCityId] = useState("");
  const [genderSelected, setGenderSelected] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(true);
  const [profile, setProfile] = useState<BirthProfile>(INITIAL_PROFILE);
  const [chart, setChart] = useState<FateChart | null>(null);
  const [history, setHistory] = useState<BirthProfile[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmClearAllData, setConfirmClearAllData] = useState(false);
  const [notice, setNotice] = useState("");
  const [pendingExport, setPendingExport] = useState<ExportKind | null>(null);
  const [relationshipNotesAvailable, setRelationshipNotesAvailable] = useState(false);
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
    const syncRelationshipNotes = () => setRelationshipNotesAvailable(readAllRelationshipTimelineNotes().length > 0);
    syncRelationshipNotes();
    window.addEventListener(RELATIONSHIP_NOTES_CHANGED_EVENT, syncRelationshipNotes);
    return () => window.removeEventListener(RELATIONSHIP_NOTES_CHANGED_EVENT, syncRelationshipNotes);
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
  const previewBranch = useMemo(() => preview ? getTimeBranch(`${preview.civil.hour}:00`) : "", [preview]);
  const resultStale = Boolean(chart && !isSameBirthProfileInput(profile, chart.profile));

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
    setReadingDepth("brief");
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
      setReadingDepth("brief");
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
      setReadingDepth("brief");
      const records = [next, ...history.filter((item) => !(item.date === next.date && item.time === next.time && item.gender === next.gender))].slice(0, 8);
      setHistory(records);
      try { localStorage.setItem("cyberfate-history", JSON.stringify(records)); } catch { /* 会话内仍可使用 */ }
      setExploreMode(intent);
      navigateToTab("overview");
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
      setReadingDepth("brief");
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
    setConfirmClearAllData(false);
  }

  function removeProfile(id: string, includeRelated: boolean) {
    const records = history.filter((item) => item.id !== id);
    setHistory(records);
    try { localStorage.setItem("cyberfate-history", JSON.stringify(records)); } catch { /* 会话内仍可删除 */ }
    if (includeRelated) {
      updateObservations(observations.filter((item) => item.profileId !== id));
      removeRelationshipTimelineNotes(id);
      if (chart?.profile.id === id) {
        setChart(null);
        setHasResult(false);
        setProfile({ ...INITIAL_PROFILE, createdAt: new Date().toISOString() });
        setCityId("");
        setGenderSelected(false);
        setTab("overview");
      }
    }
    setPendingDeleteId(null);
    setConfirmClear(false);
    setConfirmClearAllData(false);
    flashNotice(includeRelated ? "档案、关联观测与关系复盘已删除" : "档案已删除；关联观测与关系复盘已保留", 3200);
  }

  function clearHistory() {
    if (!confirmClear) {
      setConfirmClear(true);
      setConfirmClearAllData(false);
      setPendingDeleteId(null);
      return;
    }
    localStorage.removeItem("cyberfate-history");
    setHistory([]);
    setConfirmClear(false);
    flashNotice("已清空档案列表；观测与关系复盘仍保留", 3000);
  }

  function clearAllLocalData() {
    const removedKeys = clearCyberfateLocalData(localStorage);
    setHistory([]);
    setObservations([]);
    setRelationshipNotesAvailable(false);
    setChart(null);
    setHasResult(false);
    setProfile({ ...INITIAL_PROFILE, createdAt: new Date().toISOString() });
    setCityId("");
    setGenderSelected(false);
    setTab("overview");
    setExploreMode("self");
    setIntent("self");
    setHistoryOpen(false);
    setPendingDeleteId(null);
    setConfirmClear(false);
    setConfirmClearAllData(false);
    setRailCollapsed(false);
    setMobileControlsOpen(false);
    flashNotice(removedKeys.length ? "已清除 Cyberfate 在此浏览器保存的全部本地数据" : "当前浏览器没有可清除的 Cyberfate 本地数据", 3600);
  }

  function downloadChart() {
    if (!hasResult || !chart) return;
    downloadJson(`cyberfate-${chart.profile.name || chart.profile.date}.json`, {
      format: "cyberfate-chart",
      version: 1,
      algorithmVersion: ALGORITHM_VERSION,
      exportedAt: new Date().toISOString(),
      chart,
      observations: observations.filter((record) => record.profileId === chart.profile.id),
    });
    setPendingExport(null);
    flashNotice("当前命盘已下载，请妥善保管含有生辰资料的文件", 3200);
  }

  function downloadBackup() {
    downloadJson(`cyberfate-backup-${localDateValue()}.json`, {
      format: "cyberfate-backup",
      version: 2,
      algorithmVersion: ALGORITHM_VERSION,
      exportedAt: new Date().toISOString(),
      profiles: history,
      observations,
      relationshipNotes: readAllRelationshipTimelineNotes(),
    });
    setPendingExport(null);
    flashNotice("完整备份已下载；文件未加密，请存放在可信位置", 3200);
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("备份文件超过 5MB，请检查是否选择了正确文件");
      const value = JSON.parse(await file.text()) as { format?: string; version?: number; profiles?: unknown[]; observations?: unknown[]; relationshipNotes?: unknown[] };
      if (value.format !== "cyberfate-backup" || (value.version !== 1 && value.version !== 2) || !Array.isArray(value.profiles) || !Array.isArray(value.observations) || (value.version === 2 && !Array.isArray(value.relationshipNotes))) {
        throw new Error("请选择由本应用导出的完整备份文件");
      }
      const importedProfiles = value.profiles.filter(isBirthProfile);
      const importedObservations = value.observations.filter(isObservationRecord);
      const mergedProfiles = [...history, ...importedProfiles.filter((item) => !history.some((local) => local.id === item.id))].slice(0, 8);
      const importedRelationshipNotes: RelationshipNotesBackupEntry[] = normalizeRelationshipNotesBackupEntries(value.relationshipNotes ?? []);
      if (!importedProfiles.length && !importedObservations.length && !importedRelationshipNotes.length) throw new Error("备份中没有可恢复的档案、观测或关系复盘记录");
      const mergedObservations = [...observations, ...importedObservations.filter((item) => !observations.some((local) => local.id === item.id))];
      // 先写盘、后动界面状态：写入失败时保持原状，避免"界面已恢复、刷新即失"。
      try { localStorage.setItem("cyberfate-history", JSON.stringify(mergedProfiles)); } catch { throw new Error("浏览器无法写入本地档案，请检查隐私模式或可用空间"); }
      const restoredRelationship = restoreRelationshipTimelineNotes(importedRelationshipNotes);
      setHistory(mergedProfiles);
      updateObservations(mergedObservations);
      flashNotice(`已恢复 ${importedProfiles.length} 个档案、${importedObservations.length} 条观测与 ${restoredRelationship.restoredNotes} 条关系复盘`, 3800);
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

  function saveProductObservation(
    source: ObservationSource,
    sourceId: string,
    title: string,
    question: string,
    observedOn = new Date().toISOString().slice(0, 10),
    initial?: Pick<ObservationRecord, "status" | "note"> & { reviewOn?: string },
  ) {
    if (!chart) return;
    if (resultStale) {
      holdNotice("资料已修改，请重新生成后再留下观察");
      return;
    }
    if (observations.some((record) => record.profileId === chart.profile.id && record.sourceId === sourceId)) return;
    const record = createObservationRecord({
      profileId: chart.profile.id,
      profileName: chart.profile.name || "未命名命盘",
      source,
      sourceId,
      title,
      question,
      observedOn,
      reviewOn: initial ? initial.reviewOn : localDateAfter(30),
    });
    updateObservations([{ ...record, status: initial?.status ?? record.status, note: initial?.note ?? record.note }, ...observations]);
    trackLocalEvent("observation_saved", { source });
    flashNotice("问题已加入观测簿，日后可回来核对", 2600);
  }

  function saveGuidedObservation(draft: ObservationDraft) {
    saveProductObservation(draft.source, draft.sourceId, draft.title, draft.question, draft.observedOn, {
      status: draft.status,
      note: draft.note,
      reviewOn: draft.reviewOn,
    });
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
            <button onClick={() => setPendingExport("chart")} disabled={!hasResult || resultStale} title={resultStale ? "资料已修改，请重新生成后再导出" : hasResult ? "导出当前命盘" : "生成命盘后可导出"}><Icon name="download" />导出</button>
          </div>
        </header>

        <div className={`workspace ${hasResult ? "has-result" : ""} ${railCollapsed ? "rail-collapsed" : ""}`}>
          <aside className="control-rail">
            {railCollapsed && <button className="desktop-rail-toggle" aria-expanded="false" aria-controls="birth-controls" onClick={() => setRailCollapsed(false)}><Icon name="compass" /><span>资料</span></button>}
            <button className="mobile-rail-toggle" aria-expanded={mobileControlsOpen} aria-controls="birth-controls" onClick={() => setMobileControlsOpen((value) => !value)}>
              <span><small>{hasResult ? "当前档案" : "准备起盘"}</small><strong>{hasResult ? (chart?.profile.name || "未命名命盘") : (profile.name || "填写出生资料")}</strong><em>{hasResult ? chart?.profile.date : (profile.date || "尚未选择日期")} · {(hasResult ? chart?.profile.timeKnown : profile.timeKnown) === false ? "时辰未知" : (hasResult ? chart?.profile.time : (profile.time || "尚未选择时间"))}</em></span>
              <b>{mobileControlsOpen ? "收起资料" : hasResult ? "修改资料" : "开始填写"}</b>
            </button>
            <div className={`rail-body ${mobileControlsOpen ? "mobile-open" : ""}`} id="birth-controls">
              <div className="rail-heading"><div><span>出生资料</span><h2>生成观察</h2></div><button className="rail-collapse-button" onClick={() => setRailCollapsed(true)} aria-label="收起出生资料">收起</button><p>只在浏览器本地计算，不上传生辰。</p></div>
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
              <button className="generate-button" disabled={!draftReady || isCalculating} onClick={generate}><Icon name="spark" /><span>{isCalculating ? "正在计算" : resultStale ? "重新生成我的观察" : "生成我的观察"}<small>{draftReady ? resultStale ? "应用刚才修改的资料" : "依当前资料起盘" : "请先完成必填资料"}</small></span><Icon name="arrow" /></button>
              <p className="privacy-note"><Icon name="compass" size={15} /> 本地计算 · 生辰不会上传</p>
            </div>
          </aside>

          <section className="content-stage">
            {hasResult && chart?.profile.id === "sample" && <div className="sample-mode-banner" role="status"><b>示例数据</b><span>当前内容用于体验功能，不代表你的命盘。</span><button onClick={startPersonalInput}>填写我的资料</button></div>}
            {hasResult && !resultStale && <nav className="tabbar" role="tablist" aria-label="命盘视图">
              {TAB_ITEMS.map((item) => <button id={`view-tab-${item.id}`} aria-controls="view-panel" tabIndex={tab === item.id ? 0 : -1} role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "active" : ""} onKeyDown={(event) => handleTabArrow(event, TAB_ITEMS.map((entry) => entry.id), tab, navigateToTab, "view-tab-")} onClick={() => navigateToTab(item.id)}><span>{item.label}</span><small>{item.hint}</small></button>)}
            </nav>}
            <div className="view-container" id="view-panel" role={hasResult ? "tabpanel" : undefined} aria-labelledby={hasResult ? `view-tab-${tab}` : undefined}>
              {!hasResult && <OnboardingView intent={intent} onIntentChange={setIntent} onStart={startInput} onSample={showSample} />}
              {hasResult && resultStale && <section className="stale-result-notice" role="status"><div><span>结果待更新</span><h1>出生资料已修改</h1><p>当前结果仍基于上一次生成时的资料，尚未应用刚才的修改。请重新生成后再查看、导出或留下观察。</p></div><button disabled={!draftReady || isCalculating} onClick={generate}>{isCalculating ? "正在重新生成" : "按新资料重新生成"}</button></section>}
              {hasResult && !resultStale && chart && tab === "overview" && (chart.profile.timeKnown === false ? <UnknownTimeOverview chart={chart} records={observations} onSave={saveLimitedObservation} onAddTime={requestKnownTime} /> : <Overview chart={chart} intent={intent} records={observations} readingDepth={readingDepth} onReadingDepthChange={setReadingDepth} onSaveInsight={saveInsight} onSaveGuidedObservation={saveGuidedObservation} onNavigate={navigateToTab} />)}
              {hasResult && !resultStale && chart && tab === "explore" && <ExplorationView chart={chart} mode={exploreMode} records={observations} onModeChange={setExploreMode} onSaveInsight={saveInsight} onSaveObservation={saveProductObservation} onNavigate={navigateToTab} />}
              {hasResult && !resultStale && chart && tab === "observations" && <ObservationView chart={chart} records={observations} onChange={updateObservations} onExplore={() => navigateToTab("overview")} />}
              {hasResult && !resultStale && chart && tab === "expert" && <ExpertView chart={chart} mode={expertMode} onModeChange={setExpertMode} />}
              {isCalculating && !chart && <FeatureLoading />}
            </div>
          </section>
        </div>

        {historyOpen && <div className="history-popover">
          <header><div><span>LOCAL ARCHIVE · {history.length}/8</span><h2>本地档案</h2></div><button onClick={closeHistory} aria-label="关闭本地档案">×</button></header>
          <div className="history-backup-actions">
            <button onClick={() => setPendingExport("backup")} disabled={!history.length && !observations.length && !relationshipNotesAvailable}>备份全部</button>
            <button onClick={() => importInputRef.current?.click()}>恢复备份</button>
            <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importBackup} />
            <p>备份包含全部本地档案、观测与关系复盘；恢复时按记录编号合并，同编号数据以当前浏览器为准。</p>
          </div>
          {history.length ? <div className="history-list">{history.map((item) => <div className="history-item" key={item.id}>
            <button className="history-load" onClick={() => loadProfile(item)}><span><b>{item.name || "未命名"}</b><small>{item.date} · {item.timeKnown === false ? "时辰未知" : item.time} · {item.gender}命</small></span><Icon name="arrow" /></button>
            <button
              className={`history-delete ${pendingDeleteId === item.id ? "confirm" : ""}`}
              aria-expanded={pendingDeleteId === item.id}
              aria-controls={`delete-options-${item.id}`}
              onClick={() => {
                setPendingDeleteId((current) => current === item.id ? null : item.id);
                setConfirmClear(false);
                setConfirmClearAllData(false);
              }}
              aria-label={`${pendingDeleteId === item.id ? "收起删除选项" : "删除"}${item.name || "未命名档案"}`}
            >{pendingDeleteId === item.id ? "收起" : "删除"}</button>
            {pendingDeleteId === item.id && <div className="history-delete-options" id={`delete-options-${item.id}`} role="group" aria-label={`删除${item.name || "未命名档案"}的范围`}>
              <p><b>选择删除范围</b><span>关联数据包含该档案的现实观测和关系复盘。</span></p>
              <button onClick={() => removeProfile(item.id, false)}>仅删除档案</button>
              <button className="danger" onClick={() => removeProfile(item.id, true)}>档案及关联数据</button>
              <button className="cancel" onClick={() => setPendingDeleteId(null)}>取消</button>
            </div>}
          </div>)}</div> : <div className="empty-history"><Icon name="history" size={28} /><p>当前没有档案；观测或关系复盘仍可能保存在本浏览器。</p></div>}
          <div className="history-footer">
            <p>档案和复盘只保存在当前浏览器，请定期备份。</p>
            <div>
              {history.length > 0 && <button className={confirmClear ? "confirm" : ""} onClick={clearHistory}>{confirmClear ? "再次点击清空档案" : "清空档案"}</button>}
              <button className="clear-all-data" disabled={confirmClearAllData} onClick={() => { setConfirmClearAllData(true); setConfirmClear(false); setPendingDeleteId(null); }}>清除全部本地数据</button>
            </div>
          </div>
          {confirmClearAllData && <div className="history-clear-confirm" role="alert">
            <p><b>这会清除当前浏览器内的全部 Cyberfate 数据</b><span>包括档案、观测、关系复盘、匿名事件和本地错误日志。此操作无法撤销，建议先下载备份。</span></p>
            <div><button onClick={() => setConfirmClearAllData(false)}>取消</button><button className="danger" onClick={clearAllLocalData}>确认清除全部</button></div>
          </div>}
        </div>}
        {historyOpen && <button className="popover-backdrop" aria-label="关闭档案" onClick={closeHistory} />}
        {notice && <div className="toast" role="status" aria-live="polite"><Icon name="spark" size={15} />{notice}</div>}
        {pendingExport && <PrivacyConfirmDialog
          title={pendingExport === "chart" ? "导出当前命盘？" : "下载完整备份？"}
          description={pendingExport === "chart"
            ? "导出的 JSON 将包含档案名称、出生日期、出生时间、传统排盘口径、出生地经度、完整盘面，以及当前档案的观测记录。文件只会下载到你的设备，不会上传到 Cyberfate。请勿在共用或不受信任的设备上保存，也不要直接公开分享。"
            : "备份将包含当前浏览器内的全部命盘档案、观测记录与关系复盘，可能涉及多人的称呼、生辰、排盘口径与经度。文件未加密，只会下载到你的设备，不会上传到 Cyberfate。请存放在可信位置，不要直接发送给他人。"}
          confirmLabel={pendingExport === "chart" ? "确认下载" : "确认下载备份"}
          onCancel={() => setPendingExport(null)}
          onConfirm={pendingExport === "chart" ? downloadChart : downloadBackup}
        />}
        <footer className="site-footer">
          <span>{ALGORITHM_VERSION} · LOCAL-FIRST</span>
          <p>观星台上无神通，只有历法与规则。所示皆传统之学，供文化研究与自我省察，不构成医疗、法律、财务或人生重大决策之依据。</p>
          <nav className="footer-links" aria-label="站内页面">
            <a href="/terms">术语词典</a>
            <a href="/method">方法与来源</a>
          </nav>
        </footer>
      </main>
    </ErrorBoundary>
  );
}
