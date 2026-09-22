/**
 * @module cd/textPatch
 * @description Write text only when it differs. CD addition.
 *
 * Assigning `textContent` always replaces the element's text node, even with
 * the identical string. In the right rail that is not free: the rail's layout
 * controller observes its whole subtree for `characterData` and `childList`,
 * so every replacement schedules a full rail layout pass, and each pass strips
 * and re-applies the panels' allocated heights. Measured on the CCTV panel
 * during a camera-grid load: 1,457 mutations in 30 s, almost all of them
 * unchanged text, driving the panel's height through remove/set cycles several
 * times a second. Comparing first turns an unchanged render into no mutation.
 */

/**
 * @param {Element|null|undefined} element
 * @param {unknown} text
 * @returns {boolean} true when the DOM was actually changed
 */
export function setText(element, text) {
  if (!element) return false;
  const next = String(text ?? '');
  if (element.textContent === next) return false;
  element.textContent = next;
  return true;
}
