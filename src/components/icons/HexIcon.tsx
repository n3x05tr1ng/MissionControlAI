type Props = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

// Hexágono de marca: celda de colmena con núcleo. Hereda color (currentColor).
export function HexIcon({ size = 16, className, strokeWidth = 1.75 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2.5 20.5 7.4v9.2L12 21.5l-8.5-4.9V7.4z" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
