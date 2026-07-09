/// <reference types="vite/client" />

// Custom Plotly core bundle (see src/lib/plotly.ts). The submodules ship no
// bundled types, so we declare the minimal surface the app uses.
declare module "plotly.js/lib/core" {
  interface PlotlyStatic {
    register: (modules: unknown[]) => void;
    react: (
      root: HTMLElement,
      data: unknown[],
      layout?: Record<string, unknown>,
      config?: Record<string, unknown>,
    ) => Promise<void>;
    purge: (root: HTMLElement) => void;
    Icons: Record<string, unknown>;
    downloadImage: (root: HTMLElement, opts: Record<string, unknown>) => Promise<string>;
  }
  const Plotly: PlotlyStatic;
  export default Plotly;
}
declare module "plotly.js/lib/bar" {
  const m: unknown;
  export default m;
}
declare module "plotly.js/lib/scatter" {
  const m: unknown;
  export default m;
}
declare module "plotly.js/lib/pie" {
  const m: unknown;
  export default m;
}
declare module "plotly.js/lib/heatmap" {
  const m: unknown;
  export default m;
}
