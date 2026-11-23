export function Icon({ name, size = 18 }: { name: "spark" | "history" | "download" | "compass" | "info" | "arrow"; size?: number }) {
  const paths = {
    spark: <path d="M12 2l1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2Zm-6.5 12 .9 2.6L9 17.5l-2.6.9L5.5 21l-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" />,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={name === "spark" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
