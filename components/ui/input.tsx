import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10 disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  <label className={cn("mb-1.5 block text-[13px] font-medium tracking-tight", className)} {...props} />
);

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn("flex min-h-[96px] w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-foreground/40", className)}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Input, Label, Textarea };
