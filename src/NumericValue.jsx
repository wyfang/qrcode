import { useState } from 'react';
import { NumberField } from '@heroui/react';

// Keep the editable draft inside HeroUI, so intermediate input such as "24."
// does not change the preview until Enter, blur, or a keyboard step commits it.
export default function NumericValue({ label, labelledBy, value, onChange, suffix = '', minValue = 0, maxValue = 100, step = 0.1, isDisabled = false }) {
  const [revision, setRevision] = useState(0);
  return <div className="numeric-value">
    <NumberField key={revision} slot={null} className="numeric-field" variant="secondary"
      aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy}
      value={value} minValue={minValue} maxValue={maxValue} step={step}
      formatOptions={{ useGrouping: false, maximumFractionDigits: 1 }}
      isDisabled={isDisabled}
      onChange={next => {
        if (Number.isFinite(next)) onChange(Math.min(maxValue, Math.max(minValue, next)));
        else setRevision(previous => previous + 1);
      }}>
      <NumberField.Group><NumberField.Input inputMode="decimal" enterKeyHint="done" /></NumberField.Group>
    </NumberField>
    {suffix && <span className="numeric-suffix" aria-hidden="true">{suffix.trim()}</span>}
  </div>;
}
