import * as React from "react";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  color?: "green" | "red" | "gray";
};

export function Badge({ color = "gray", className = "", ...props }: BadgeProps) {
  const base = "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium";
  const palette =
    color === "green"
      ? "bg-green-100 text-green-800"
      : color === "red"
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-800";
  return <span className={`${base} ${palette} ${className}`} {...props} />;
}


