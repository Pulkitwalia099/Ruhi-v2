import { createRoot } from "react-dom/client";

// --------------------------------------------
// src/lib/editor/react-renderer.tsx
//
// export function renderReactComponent()    L9
// --------------------------------------------

export function renderReactComponent(
  component: React.ReactElement,
  dom: HTMLElement
) {
  const root = createRoot(dom);
  root.render(component);

  return {
    destroy: () => root.unmount(),
  };
}
