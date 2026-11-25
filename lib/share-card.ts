import type { CompatibilityReport } from "@/lib/relationship";

const STATUS_COLORS: Record<string, string> = {
  协同: "#64b28b",
  互补: "#d4d0bd",
  中性: "#8fa3ab",
  需经营: "#d7674d",
};

const W = 1080;
const H = 1440;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of text) {
    if (ctx.measureText(line + char).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawStarField(ctx: CanvasRenderingContext2D) {
  // 以字符串作伪随机种子，同一份摘要每次生成的星点一致。
  let seed = 20260127;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  ctx.fillStyle = "rgba(212, 208, 189, 0.5)";
  for (let i = 0; i < 90; i += 1) {
    const x = random() * W;
    const y = random() * H;
    const r = random() * 1.6 + 0.4;
    ctx.globalAlpha = 0.25 + random() * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawOrbit(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, label: string) {
  ctx.strokeStyle = "rgba(140, 163, 171, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(140, 163, 171, 0.2)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(212, 208, 189, 0.85)";
  ctx.font = "500 34px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, cx, cy + 12);
}

export interface ShareCardInput {
  report: CompatibilityReport;
  aName: string;
  bName: string;
  approximate: boolean;
}

export function buildAnonymizedCompatibilitySummary(report: CompatibilityReport, approximate: boolean) {
  const dimensions = approximate ? report.dimensions.slice(0, 3) : report.dimensions;
  return [
    "CYBERFATE · 双人合盘 · A/B 摘要",
    `A × B：${report.relationLabel}`,
    report.headline,
    ...dimensions.map((dimension) => `${dimension.name}｜${dimension.status}：${dimension.detail}`),
    approximate ? "B 时辰未知：仅保留日柱层面的有限比较。" : "",
    "传统规则推演，仅供共同讨论，不作为关系决策依据。分享前请确认对方知情。",
  ].filter(Boolean).join("\n");
}

/** 在浏览器内以 Canvas 绘制 A/B 代称合盘分享卡；不引入任何图片资源，无跨域污染。 */
export function renderCompatibilityShareCard({ report, aName, bName, approximate }: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("当前浏览器不支持画布绘制"));

  const font = "'PingFang SC', 'Microsoft YaHei', sans-serif";

  // 背景
  ctx.fillStyle = "#0a1214";
  ctx.fillRect(0, 0, W, H);
  drawStarField(ctx);
  drawOrbit(ctx, W - 190, 240, 96, "合");

  const left = 84;
  const maxWidth = W - left * 2;
  ctx.textAlign = "left";

  // 页眉
  ctx.fillStyle = "#8fa3ab";
  ctx.font = `600 26px ${font}`;
  ctx.fillText("CYBERFATE · 双人合盘 · A/B 摘要", left, 110);

  // 分享卡只使用 A/B 代称；调用方也会固定传入 A/B。
  ctx.fillStyle = "#e9e4d8";
  ctx.font = `600 72px ${font}`;
  ctx.fillText(`${aName || "A"} × ${bName || "B"}`, left, 210);

  // 关系结构
  ctx.fillStyle = "#d7674d";
  ctx.font = `500 44px ${font}`;
  ctx.fillText(report.relationLabel, left, 286);

  // 摘要句
  ctx.fillStyle = "#c9c4b6";
  ctx.font = `400 30px ${font}`;
  let y = 350;
  for (const line of wrapText(ctx, report.headline, maxWidth)) {
    ctx.fillText(line, left, y);
    y += 48;
  }

  if (approximate) {
    ctx.fillStyle = "#8fa3ab";
    ctx.font = `400 26px ${font}`;
    y += 6;
    ctx.fillText("对方时辰未知：仅保留日柱层面的有限比较。", left, y);
    y += 54;
  } else {
    y += 8;
  }

  // 维度行
  y += 26;
  for (const dimension of report.dimensions) {
    ctx.fillStyle = "#e9e4d8";
    ctx.font = `600 34px ${font}`;
    ctx.fillText(dimension.name, left, y);
    ctx.fillStyle = STATUS_COLORS[dimension.status] ?? "#8fa3ab";
    ctx.font = `500 30px ${font}`;
    ctx.textAlign = "right";
    ctx.fillText(dimension.status, W - left, y);
    ctx.textAlign = "left";
    y += 20;
    ctx.fillStyle = "#8fa3ab";
    ctx.font = `400 26px ${font}`;
    for (const line of wrapText(ctx, dimension.detail, maxWidth)) {
      ctx.fillText(line, left, y);
      y += 40;
    }
    y += 30;
    if (y > H - 230) break;
  }

  // 页脚
  ctx.strokeStyle = "rgba(140, 163, 171, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, H - 160);
  ctx.lineTo(W - left, H - 160);
  ctx.stroke();
  ctx.fillStyle = "#8fa3ab";
  ctx.font = `400 26px ${font}`;
  ctx.fillText("传统规则推演 · 仅供共同讨论 · 不作为关系决策依据", left, H - 110);
  ctx.fillStyle = "#5c6f76";
  ctx.font = `400 24px ${font}`;
  ctx.fillText("均在浏览器内本地计算，分享图不含完整生辰。", left, H - 66);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("分享卡片生成失败"));
    }, "image/png");
  });
}

export function downloadShareCard(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
