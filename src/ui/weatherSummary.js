/** Compact, event-driven context for enabled weather, independent of panel collapse. */
export function createWeatherSummary({ container, onOpen = () => {} } = {}) {
  const document = container?.ownerDocument;
  if (!document?.createElement) return null;
  const root = document.createElement('section');
  root.className = 'weather-summary';
  root.setAttribute('aria-label', 'Active weather');
  root.hidden = true;
  const title = document.createElement('div');
  title.className = 'weather-summary-title';
  title.textContent = 'WEATHER';
  root.appendChild(title);
  const rows = new Map();
  const text = (element, value) => {
    const next = String(value || '');
    if (element.textContent !== next) element.textContent = next;
  };
  const click = (event) => {
    const button = event.target?.closest?.('[data-weather-open]');
    if (button) onOpen(button.dataset.weatherOpen);
  };
  root.addEventListener('click', click);
  container.appendChild(root);
  return {
    update(entries) {
      const active = new Set();
      for (const { id, summary, legend = [] } of entries) {
        if (!summary) continue;
        active.add(id);
        let row = rows.get(id);
        if (!row) {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = 'weather-summary-product';
          element.dataset.weatherOpen = id;
          const label = document.createElement('strong');
          const detail = document.createElement('span');
          const status = document.createElement('span');
          status.className = 'weather-summary-status';
          const ramp = document.createElement('span');
          ramp.className = 'weather-summary-ramp';
          const scale = document.createElement('span');
          scale.className = 'weather-summary-scale';
          for (const node of [label, detail, status, ramp, scale])
            element.appendChild(node);
          root.appendChild(element);
          row = { element, label, detail, status, ramp, scale };
          rows.set(id, row);
        }
        text(row.label, summary.label);
        text(row.detail, summary.detail);
        text(row.status, summary.status);
        row.status.hidden = !summary.status;
        row.element.title = 'Open weather controls';
        const colors = legend
          .map(({ color }) => color)
          .filter((color) => /^#[0-9a-f]{6}$/i.test(color));
        row.ramp.hidden = row.scale.hidden = colors.length < 2;
        const gradient =
          colors.length > 1
            ? `linear-gradient(to right, ${colors.join(',')})`
            : '';
        if (row.gradient !== gradient) {
          row.ramp.style.background = gradient;
          row.gradient = gradient;
        }
        text(
          row.scale,
          colors.length > 1
            ? `${legend[0].label} — ${legend.at(-1).label} ${summary.units || ''}`
            : '',
        );
      }
      for (const [id, row] of rows)
        if (!active.has(id)) {
          row.element.remove();
          rows.delete(id);
        }
      root.hidden = rows.size === 0;
    },
    destroy() {
      root.removeEventListener('click', click);
      root.remove();
      rows.clear();
    },
  };
}
