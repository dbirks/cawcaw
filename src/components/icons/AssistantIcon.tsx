interface AssistantIconProps {
  size?: number;
  className?: string;
}

export const AssistantIcon = ({ size = 16, className = '' }: AssistantIconProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Assistant"
    >
      {/* AI Assistant icon - stylized robot/AI head */}
      <path
        d="M12 2C13.1 2 14 2.9 14 4V5C16.2 5.2 18 7.1 18 9.5V15.5C18 17.4 16.4 19 14.5 19H13V21C13 21.6 12.6 22 12 22S11 21.6 11 22V19H9.5C7.6 19 6 17.4 6 15.5V9.5C6 7.1 7.8 5.2 10 5V4C10 2.9 10.9 2 12 2Z"
        fill="currentColor"
      />
      <circle cx="9.5" cy="11" r="1" fill="#fff" />
      <circle cx="14.5" cy="11" r="1" fill="#fff" />
      <path
        d="M9 14.5C9.8 15.1 10.9 15.5 12 15.5S14.2 15.1 15 14.5"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Antenna/signal indicator */}
      <circle cx="12" cy="4" r="1" fill="currentColor" />
    </svg>
  );
};
