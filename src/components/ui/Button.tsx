import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 min-h-[44px]",
          {
            "bg-primary text-on-primary hover:bg-primary/90": variant === "default",
            "bg-destructive text-white hover:bg-destructive/90": variant === "destructive",
            "border border-input bg-background hover:bg-accent hover:text-white": variant === "outline",
            "bg-secondary text-white hover:bg-secondary/80": variant === "secondary",
            "hover:bg-accent hover:text-white": variant === "ghost",
            "text-primary underline-offset-4 hover:underline": variant === "link",
            "h-11 px-4 py-2": size === "default",
            "h-9 rounded-md px-3": size === "sm",
            "h-14 rounded-md px-8": size === "lg",
            "h-11 w-11": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
