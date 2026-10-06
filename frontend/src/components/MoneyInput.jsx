import { useEffect, useState } from 'react';

function parseDigits(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/\D/g, '');
}

function formatWithSeparator(digits) {
  if (!digits) return '';
  return Number(digits).toLocaleString('id-ID');
}

/**
 * MoneyInput renders a text input with Indonesian thousand separator (e.g. 50.000).
 * It calls onChange with a pure number (or '' when empty).
 */
export default function MoneyInput({
  value,
  onChange,
  placeholder = '0',
  autoFocus = false,
  size = 'md',
  ...rest
}) {
  const [display, setDisplay] = useState(
    value === '' || value === null || value === undefined
      ? ''
      : formatWithSeparator(parseDigits(value))
  );

  useEffect(() => {
    const next = value === '' || value === null || value === undefined
      ? ''
      : formatWithSeparator(parseDigits(value));
    if (next !== display) setDisplay(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handle = (e) => {
    const digits = parseDigits(e.target.value);
    setDisplay(formatWithSeparator(digits));
    onChange(digits === '' ? '' : Number(digits));
  };

  return (
    <div className="money-input-wrap" data-size={size}>
      <span className="money-prefix">Rp</span>
      <input
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={handle}
        placeholder={placeholder}
        autoFocus={autoFocus}
        {...rest}
      />
    </div>
  );
}
