import React from "react";
import { type LucideIcon } from "lucide-react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  tooltip: string;
  variant?: "default" | "primary" | "danger" | "warning" | "success" | "ghost";
  size?: "sm" | "md" | "lg";
  iconSize?: number;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  tooltip,
  variant = "default",
  size = "sm",
  iconSize,
  className = "",
  disabled,
  ...props
}) => {
  const resolvedIconSize = iconSize || (size === "sm" ? 15 : size === "md" ? 18 : 20);

  return (
    <button
      type="button"
      title={tooltip}
      aria-label={tooltip}
      disabled={disabled}
      className={`btn-action btn-action-${variant} btn-action-${size} ${className}`}
      {...props}
    >
      <Icon size={resolvedIconSize} strokeWidth={2} />
    </button>
  );
};

export default IconButton;
