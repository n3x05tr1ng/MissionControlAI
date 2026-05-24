type Props = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

export function HexIcon({
  size = 16,
  className,
  strokeWidth = 1.75,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2 21 7v10l-9 5-9-5V7z" />
    </svg>
  );
}
