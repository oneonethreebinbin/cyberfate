import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cyberfate · 数字命理观星台",
    short_name: "Cyberfate",
    description: "闭门起盘：本地推演紫微斗数、子平八字与姻缘结构。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a1214",
    theme_color: "#0a1214",
    lang: "zh-CN",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
