import { cn } from "@/lib/utils";
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "outline" | "ghost" | "danger" | "success";
    size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "md", ...props }, ref) => {
        const variants = {
            default: "bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm",
            outline: "border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-900",
            ghost: "hover:bg-zinc-100 text-zinc-700",
            danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
            success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
        };

        const sizes = {
            sm: "h-8 px-3 text-xs",
            md: "h-10 px-4 py-2",
            lg: "h-12 px-8 text-lg",
            icon: "h-10 w-10 p-2 flex items-center justify-center"
        };

        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50 disabled:pointer-events-none",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";
