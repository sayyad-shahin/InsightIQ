// Custom partial Plotly bundle: the core renderer plus only the trace types the
// app actually uses (bar, scatter/line/area, pie, heatmap). This is ~1.2MB
// versus the full 4.7MB dist, and is still route-split + lazy-loaded so it never
// affects the initial page load.
import Plotly from "plotly.js/lib/core";
import bar from "plotly.js/lib/bar";
import heatmap from "plotly.js/lib/heatmap";
import pie from "plotly.js/lib/pie";
import scatter from "plotly.js/lib/scatter";

Plotly.register([bar, scatter, pie, heatmap]);

export default Plotly;
