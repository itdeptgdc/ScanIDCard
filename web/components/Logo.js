// Official Poipet Resort & Casino logo (transparent PNG in /public).
export const LOGO_SRC = '/logo.png';

export default function Logo({ size = 48, className = '' }) {
  return <img src={LOGO_SRC} alt="Poipet Resort & Casino" width={size} height={size} className={`logo ${className}`} draggable={false} />;
}
