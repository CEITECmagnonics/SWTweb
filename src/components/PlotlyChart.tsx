import { useEffect, useRef, type RefObject } from 'react';
import Plotly from 'plotly.js-dist-min';

const CONFIG: Partial<Plotly.Config> = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
  toImageButtonOptions: { format: 'png', scale: 2 },
};

export function PlotlyChart({
  data,
  layout,
  divRef,
}: {
  data: Plotly.Data[];
  layout: Partial<Plotly.Layout>;
  divRef: RefObject<HTMLDivElement | null>;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    void Plotly.react(el, data, layout, CONFIG);
  }, [data, layout]);

  useEffect(() => {
    const el = innerRef.current;
    return () => {
      if (el) Plotly.purge(el);
    };
  }, []);

  return (
    <div
      ref={(el) => {
        innerRef.current = el;
        divRef.current = el;
      }}
      className="h-[480px] w-full"
    />
  );
}
