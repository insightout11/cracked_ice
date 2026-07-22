import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

export const Modal = DialogPrimitive.Root;
export const ModalTrigger = DialogPrimitive.Trigger;
export const ModalClose = DialogPrimitive.Close;

export const ModalContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-surface-0/80 backdrop-blur-sm" />
    <DialogPrimitive.Content ref={ref} className={cn('fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(92vw,36rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-surface-raised p-6 text-ink shadow-raised [backdrop-filter:var(--frost)]', className)} {...props}>
      {children}
      <DialogPrimitive.Close asChild><Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Close dialog"><X size={18} /></Button></DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
ModalContent.displayName = 'ModalContent';

export const ModalTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={cn('font-display text-xl font-semibold', className)} {...props} />);
ModalTitle.displayName = 'ModalTitle';
export const ModalDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} className={cn('mt-2 text-sm text-ink-dim', className)} {...props} />);
ModalDescription.displayName = 'ModalDescription';

export const Drawer = Modal;
export const DrawerTrigger = ModalTrigger;
export const DrawerClose = ModalClose;
export const Sheet = Modal;
export const SheetTrigger = ModalTrigger;
export const SheetClose = ModalClose;

export const DrawerContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-surface-0/80 backdrop-blur-sm" />
    <DialogPrimitive.Content ref={ref} className={cn('fixed inset-y-0 right-0 z-50 w-[min(92vw,28rem)] overflow-y-auto border-l border-line bg-surface-raised p-6 text-ink shadow-raised [backdrop-filter:var(--frost)]', className)} {...props}>{children}</DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DrawerContent.displayName = 'DrawerContent';
export const SheetContent = DrawerContent;
