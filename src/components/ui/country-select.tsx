"use client";

import { useLocale } from "next-intl";
import { Select } from "@/components/ui/field";
import { countryOptions } from "@/lib/countries";

export function CountrySelect({
  id,
  name,
  defaultValue,
  placeholder,
}: {
  id: string;
  name: string;
  defaultValue?: string | null;
  placeholder: string;
}) {
  const locale = useLocale();
  const options = countryOptions(locale);
  const known = options.some((o) => o.code === defaultValue);

  return (
    <Select id={id} name={name} defaultValue={defaultValue ?? ""}>
      <option value="">{placeholder}</option>
      {/* keep whatever was already stored, even if it is not in the list */}
      {defaultValue && !known ? <option value={defaultValue}>{defaultValue}</option> : null}
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.name}
        </option>
      ))}
    </Select>
  );
}
