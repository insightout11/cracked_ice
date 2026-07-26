import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectControlProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  ariaLabel: string;
  className?: string;
}

export function SelectControl({ value, onValueChange, options, ariaLabel, className }: SelectControlProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn('inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-line bg-surface-0 px-3 text-sm font-semibold text-ink outline-none transition-colors hover:border-line-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20', className)}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon><ChevronDown className="size-4 text-ink-mute" aria-hidden="true" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-[10000] max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line-strong bg-surface-1 text-ink shadow-2xl"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex min-h-9 cursor-default select-none items-center rounded-md py-2 pl-8 pr-3 text-sm outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent-muted data-[highlighted]:text-accent"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2"><Check className="size-4" aria-hidden="true" /></SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
