/**
 * KKM Hotel logo. `full` = the complete logo (house, KKM, HOTEL, tagline) for large spots;
 * otherwise the house + KKM mark, which stays readable at small sizes (navbar, sidebar).
 */
export default function BrandLogo({ full = false, className = 'w-10 h-10 rounded-xl' }) {
  const src = `${process.env.PUBLIC_URL}/${full ? 'logo.png' : 'favicon-192.png'}`;
  return <img src={src} alt="KKM Hotel" width="512" height="512" className={`object-cover flex-shrink-0 ${className}`} draggable="false" />;
}
