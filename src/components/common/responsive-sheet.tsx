"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsTabletUp } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

interface ResponsiveSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Sticky footer actions (e.g. Cancel / Save). */
  footer?: React.ReactNode
  /** Dialog width on tablet/desktop. */
  size?: "sm" | "md" | "lg"
  children: React.ReactNode
}

const sizes = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl" }

/**
 * Bottom sheet on phones, centred dialog from `sm` up. Use for create/edit
 * forms so mobile users get a thumb-friendly sheet.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = "md",
  children,
}: ResponsiveSheetProps) {
  const isTabletUp = useIsTabletUp()

  if (isTabletUp) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("max-h-[90dvh] grid-rows-[auto_1fr_auto] p-0", sizes[size])}>
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-5 pb-5">{children}</div>
          {footer ? <DialogFooter className="m-0 rounded-b-xl px-5 py-3">{footer}</DialogFooter> : null}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="select-text">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-lg font-semibold">{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer ? <DrawerFooter className="border-t pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</DrawerFooter> : null}
      </DrawerContent>
    </Drawer>
  )
}
