import { createPortal } from 'react-dom';

/**
 * Renders a full-screen overlay into <body>, so the page's animation / scroll container can't
 * trap it inside the content area (which made popups appear cut off at the bottom).
 */
export default function ScreenOverlay({ children }) {
  return createPortal(children, document.body);
}
