import { useState } from "react"
import { Check, ChevronsUpDown, Settings } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { FormField } from "./FormField"

interface PaymentMethodSelectorProps {
  value: string
  onChange: (value: string) => void
  paymentMethods: Array<{ id: string; value: string; label: string }>
  error?: string
}

export function PaymentMethodSelector({ value, onChange, paymentMethods, error }: PaymentMethodSelectorProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleSelect = (selectedValue: string) => {
    const method = paymentMethods.find(pm => pm.value === selectedValue)
    if (method) {
      onChange(method.id)
    }
    setOpen(false)
  }

  return (
    <FormField label="Payment Method" error={error} required>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              error ? "border-destructive" : ""
            )}
          >
            {value
              ? paymentMethods.find(method => method.id === value)?.value || "Unknown payment method"
              : "Select payment method..."
            }
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder="Search payment method..." />
            <CommandEmpty>No payment method found.</CommandEmpty>
            <CommandList className="max-h-[300px] overflow-auto">
              <CommandGroup>
                <div className="flex items-center justify-between px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  <span>Payment Methods</span>
                  <Settings
                    className="h-4 w-4 cursor-pointer hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpen(false)
                      navigate('/settings?tab=options')
                    }}
                  />
                </div>
                {paymentMethods.map((method) => (
                  <CommandItem
                    key={method.value}
                    value={method.value}
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === method.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {method.value}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FormField>
  )
}