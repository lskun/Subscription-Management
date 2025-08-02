import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { currencySymbols } from "@/utils/currency"
import { SUPPORTED_CURRENCIES } from "@/config/currency"

interface CurrencySelectorProps {
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export function CurrencySelector({
  value,
  onValueChange,
  className
}: CurrencySelectorProps) {
  const [open, setOpen] = useState(false)

  // Use supported currencies list instead of fetching exchange rates
  const currencies = SUPPORTED_CURRENCIES.map((code) => ({
    value: code,
    label: code, // Only show currency code
    symbol: currencySymbols[code] || code
  }))

  // Find the selected currency
  const selectedCurrency = currencies.find(
    (currency) => currency.value === value
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-left", className)}
        >
          <span className="flex items-center gap-2 flex-1 min-w-0">
            {selectedCurrency ? (
              <span className="truncate">{selectedCurrency.value}</span>
            ) : (
              <span className="text-muted-foreground">Select currency</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search currency..." />
          <CommandEmpty>No currency found.</CommandEmpty>
          <CommandList className="max-h-60">
            <CommandGroup>
              {currencies.map((currency) => (
                <CommandItem
                  key={currency.value}
                  value={currency.value}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === currency.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{currency.value}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}