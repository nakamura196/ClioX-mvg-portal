interface FormFieldContent {
  label: string
  name: string
  type?: string
  options?: string[]
  // Display text for `options`, index-aligned. Lets a locale override translate
  // what the user reads while `options` keeps the English values the rest of the
  // app switches on (e.g. `mapTimeoutStringToSeconds`). Omit for English.
  optionLabels?: string[]
  sortOptions?: boolean
  required?: boolean
  multiple?: boolean
  disabled?: boolean
  help?: string
  placeholder?: string
  pattern?: string
  min?: string
  disclaimer?: string
  disclaimerValues?: string[]
  advanced?: boolean
}

interface FormStepContent {
  title: string
  description?: string
  fields: FormFieldContent[]
}
