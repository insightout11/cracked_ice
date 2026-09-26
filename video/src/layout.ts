/**
 * Frame coordinates (1080x1920) shared by scenes that hand an element across a cut:
 * the Saturday bar in Nights becomes the Saturday column in Chain.
 */
export const CONTENT = { left: 90, right: 930, top: 230 };
export const CONTENT_WIDTH = CONTENT.right - CONTENT.left;

// Nights: bars stand on a fixed baseline.
export const BARS = { base: 1260, maxHeight: 600, gap: 18 };
export function barRect(index: number, count: number, room: number) {
  const width = (CONTENT_WIDTH - BARS.gap * (count - 1)) / count;
  const height = (BARS.maxHeight * room) / 100;
  return { x: CONTENT.left + index * (width + BARS.gap), y: BARS.base - height, width, height };
}

// Chain: a label column, then one column per night.
export const GRID = { top: 600, label: 190, headerHeight: 70, row: 150, rowGap: 18 };
export function gridColumn(index: number, count: number) {
  const width = (CONTENT_WIDTH - GRID.label) / count;
  return { x: CONTENT.left + GRID.label + index * width, width };
}
export function laneTop(index: number) {
  return GRID.top + GRID.headerHeight + index * (GRID.row + GRID.rowGap);
}
