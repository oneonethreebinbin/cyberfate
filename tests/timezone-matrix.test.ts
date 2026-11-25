import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const chartScript = `
  import engines from "./lib/engines.ts";
  const { createFateChart } = engines;
  const chart = createFateChart({
    id: "timezone-matrix",
    name: "跨时区一致性",
    date: "1980-04-27",
    time: "01:30",
    timeKnown: true,
    gender: "男",
    longitude: 127,
    useTrueSolarTime: true,
    createdAt: "2026-01-01T00:00:00.000Z"
  });
  process.stdout.write(JSON.stringify(chart));
`;

function chartInTimezone(timezone: string) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", chartScript], {
    cwd: projectRoot,
    env: { ...process.env, TZ: timezone },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${timezone} 子进程失败：${result.stderr}`);
  return JSON.parse(result.stdout) as unknown;
}

test("同一中国标准时间输入在不同时区设备上生成完全相同的命盘", () => {
  const shanghai = chartInTimezone("Asia/Shanghai");
  const newYork = chartInTimezone("America/New_York");
  const london = chartInTimezone("Europe/London");

  assert.deepEqual(newYork, shanghai);
  assert.deepEqual(london, shanghai);
});
