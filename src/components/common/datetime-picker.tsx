"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

interface DateTimePickerProps {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
  id?: string
}

export function DateTimePicker({ value, onChange, disabled, minDate, maxDate, id }: DateTimePickerProps) {
  // value is expected to be in "yyyy-MM-dd'T'HH:mm" format.
  const parsedDate = value ? new Date(value) : undefined

  const [date, setDate] = React.useState<Date | undefined>(parsedDate)
  const [time, setTime] = React.useState<string>(
    value ? format(new Date(value), "HH:mm") : "12:00"
  )
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    if (value) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDate(d)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTime(format(d, "HH:mm"))
      }
    }
  }, [value])

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate)
      updateValue(selectedDate, time)
    }
  }

  const handleTimeSelect = (newTime: string) => {
    setTime(newTime)
    if (date) {
      updateValue(date, newTime)
    }
  }

  const updateValue = (d: Date, t: string) => {
    const [hours, minutes] = t.split(":").map(Number)
    const updated = new Date(d)
    updated.setHours(hours)
    updated.setMinutes(minutes)
    onChange(format(updated, "yyyy-MM-dd'T'HH:mm"))
  }

  const displayString = date ? format(date, "PPP") + " at " + time : "Select date and time"

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger render={
        <Button
          id={id}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal bg-background hover:bg-muted/50",
            !value && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 size-4" aria-hidden />
          {displayString}
        </Button>
      } />
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            disabled={(d) => {
              if (minDate && d < minDate) return true
              if (maxDate && d > maxDate) return true
              return false
            }}
          />
          <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-border bg-muted/20">
            <div className="p-3 font-medium text-xs text-muted-foreground flex items-center gap-1.5 border-b border-border">
              <Clock className="size-3.5" aria-hidden /> Time
            </div>
            <div className="flex h-[160px] w-full sm:h-[280px] sm:w-auto">
              <ScrollArea className="flex-1 sm:w-16 border-r border-border">
                <div className="flex flex-col p-1">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const h = i.toString().padStart(2, "0")
                    const currentHour = time.split(":")[0]
                    return (
                      <Button
                        key={h}
                        variant="ghost"
                        className={cn(
                          "h-8 rounded-sm px-0 text-sm",
                          currentHour === h && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                        )}
                        onClick={() => handleTimeSelect(`${h}:${time.split(":")[1]}`)}
                      >
                        {h}
                      </Button>
                    )
                  })}
                </div>
              </ScrollArea>
              <ScrollArea className="flex-1 sm:w-16">
                <div className="flex flex-col p-1">
                  {Array.from({ length: 60 }).map((_, i) => {
                    const m = i.toString().padStart(2, "0")
                    const currentMinute = time.split(":")[1]
                    return (
                      <Button
                        key={m}
                        variant="ghost"
                        className={cn(
                          "h-8 rounded-sm px-0 text-sm",
                          currentMinute === m && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                        )}
                        onClick={() => handleTimeSelect(`${time.split(":")[0]}:${m}`)}
                      >
                        {m}
                      </Button>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
