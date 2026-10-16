/** Eyebrow + serif title + optional intro, centred or left-aligned. */
export default function SectionHeading({ eyebrow, title, intro, align = 'center', light = false }) {
  const centered = align === 'center';
  return (
    <div className={`reveal mb-12 ${centered ? 'text-center max-w-2xl mx-auto' : 'max-w-xl'}`}>
      {eyebrow && (
        <p className={`text-xs font-semibold tracking-[0.25em] uppercase ${light ? 'text-gold-300' : 'text-gold-600'}`}>{eyebrow}</p>
      )}
      <h2 className={`font-display text-3xl sm:text-4xl lg:text-5xl mt-3 leading-tight ${light ? 'text-white' : 'text-ink'}`}>{title}</h2>
      <div className={`h-px w-16 bg-gold mt-5 ${centered ? 'mx-auto' : ''}`} />
      {intro && <p className={`mt-5 text-base sm:text-lg leading-relaxed ${light ? 'text-white/80' : 'text-ink-soft'}`}>{intro}</p>}
    </div>
  );
}
