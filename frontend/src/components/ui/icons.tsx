import type { SVGProps } from "react";

// Hand-tuned 24px stroke icons (no icon-font download).
const paths: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14",
  flask: "M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3M7 15h10",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  trophy: "M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4Zm0 2H4a3 3 0 0 0 3 4m10-4h3a3 3 0 0 1-3 4",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.5a7.6 7.6 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 2 1.2l.4 2.5h5l.4-2.5a7.6 7.6 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14m0 3h.01",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5m5 5H3",
  play: "M7 4.5v15l12-7.5-12-7.5Z",
  step: "M5 5v14M9 5l10 7-10 7V5Z",
  back: "M19 5v14M15 5 5 12l10 7V5Z",
  reset: "M4 4v6h6M4.5 15a8 8 0 1 0 1.9-8.3L4 10",
  check: "M5 12.5 10 17 19 7",
  x: "M6 6l12 12M18 6 6 18",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5V11Z",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z",
  spark: "M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8",
  bulb: "M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.9 1.1 1 1.7l.1.4h4.8l.1-.4c.1-.6.5-1.3 1-1.7A6 6 0 0 0 12 3Z",
  robot: "M12 3v3m-6 3h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm3 5h.01M15 14h.01M9 18h6M2 13v2m20-2v2",
  moto: "M5 17a3 3 0 1 0 0-.01M19 17a3 3 0 1 0 0-.01M8 17h5l3-6h-4l-2 3H6m9-7h3l1 4",
  branch: "M6 3v12m0 0a3 3 0 1 0 0 .01M18 9a3 3 0 1 0 0-.01M18 9c0 4-6 3-12 6",
  loop: "M17 2l3 3-3 3M3 11V9a4 4 0 0 1 4-4h13M7 22l-3-3 3-3m14-3v2a4 4 0 0 1-4 4H4",
  magnifier: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 5 5",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z",
  summit: "m3 20 6-10 4 6 3-4 5 8H3Zm6-10 2-3",
  flame: "M12 21c-4 0-7-2.7-7-6.5C5 10 9 8 9 4c3 1.5 4.5 4 4.5 6 1-.5 1.8-1.6 2-2.8 2 1.6 3.5 4.2 3.5 7.3 0 3.8-3 6.5-7 6.5Z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2m0 18v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  send: "M4 12 20 4l-6 16-3-7-7-1Z",
  code: "m8 8-4 4 4 4m8-8 4 4-4 4M14 4l-4 16",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  layout: "M4 4h16v16H4V4Zm6 0v16",
};

export function Icon({ name, className, ...rest }: { name: keyof typeof paths | string; className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className ?? "size-5"} aria-hidden="true" {...rest}>
      <path d={paths[name] ?? paths.star} />
    </svg>
  );
}
