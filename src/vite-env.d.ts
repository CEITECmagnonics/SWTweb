/// <reference types="vite/client" />

/** plotly.js-dist-min ships no types; reuse the plotly.js typings. */
declare module 'plotly.js-dist-min' {
  import * as Plotly from 'plotly.js';
  export = Plotly;
}
