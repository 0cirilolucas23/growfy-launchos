"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ThemeToggle({ className, size = "md" }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "relative overflow-hidden rounded-lg border border-white/10",
          "bg-white/5 text-muted-foreground hover:bg-white/10",
          sizeClasses[size],
          className
        )}
        aria-label="Toggle theme"
        disabled
      >
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative overflow-hidden rounded-lg border border-white/10",
        "bg-white/5 text-muted-foreground",
        "hover:bg-white/10 hover:text-foreground",
        "transition-all duration-300",
        sizeClasses[size],
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Sun icon (visible in dark mode → click to go light) */}
      <Sun
        className={cn(
          "absolute transition-all duration-500",
          iconSizeClasses[size],
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0"
        )}
      />
      {/* Moon icon (visible in light mode → click to go dark) */}
      <Moon
        className={cn(
          "absolute transition-all duration-500",
          iconSizeClasses[size],
          isDark
            ? "rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100"
        )}
      />
      <span className="sr-only">
        {isDark ? "Switch to light mode" : "Switch to dark mode"}
      </span>
    </Button>
  );
}

const sizeClasses: Record<string, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

const iconSizeClasses: Record<string, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};
