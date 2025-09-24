"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  required?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  required = false,
  className
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

interface DateTimePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
}

export function DatePickerFilter({
  value,
  onChange,
  placeholder = "Pick a date",
  required = false,
  className
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  required = false,
  className
}: DateTimePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  )
  const [time, setTime] = React.useState<string>(
    value ? new Date(value).toTimeString().slice(0, 5) : ""
  )

  React.useEffect(() => {
    if (date && time) {
      const [hours, minutes] = time.split(':').map(Number)
      const newDateTime = new Date(date)
      newDateTime.setHours(hours, minutes, 0, 0)
      onChange?.(newDateTime.toISOString().slice(0, 16))
    } else if (date && !time) {
      // If only date is selected, set time to current time
      const now = new Date()
      const newDateTime = new Date(date)
      newDateTime.setHours(now.getHours(), now.getMinutes(), 0, 0)
      onChange?.(newDateTime.toISOString().slice(0, 16))
    }
  }, [date, time, onChange])

  React.useEffect(() => {
    if (value) {
      const dateValue = new Date(value)
      setDate(dateValue)
      setTime(dateValue.toTimeString().slice(0, 5))
    } else {
      setDate(undefined)
      setTime("")
    }
  }, [value])

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        placeholder="Select time"
      />
    </div>
  )
}
