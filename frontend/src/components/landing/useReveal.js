import { useEffect } from 'react';

/**
 * Adds "is-visible" to every `.reveal` element inside the page once it scrolls into view.
 * Re-scans when `deps` change (e.g. after data loads and new sections render).
 */
export function useReveal(deps = []) {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('.reveal:not(.is-visible)'));
    if (!elements.length) return undefined;

    // Older browsers / test environments: just show everything
    if (typeof window.IntersectionObserver !== 'function') {
      elements.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
