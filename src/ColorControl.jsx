import { useEffect, useId, useState } from 'react';
import { ColorArea, ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, FieldError, Input, Label, TextField, parseColor } from '@heroui/react';
import NumericValue from './NumericValue.jsx';

const PRESETS = [['#18181b','墨黑'], ['#2563eb','蓝色'], ['#7c3aed','紫色'], ['#b45309','赭色'], ['#166534','绿色'], ['#ffffff','白色']];

const serialize = color => color.toString(color.getChannelValue('alpha') === 1 ? 'hex' : 'hexa');
const toHSB = (next, previous) => {
  const hsb = next.toFormat('hsb');
  // RGB cannot retain hue for neutral colors. Keep the user's last hue so
  // selecting black/white does not erase the next color-area adjustment.
  return previous && next.getColorSpace() !== 'hsb' && hsb.getChannelValue('saturation') === 0
    ? hsb.withChannelValue('hue', previous.getChannelValue('hue'))
    : hsb;
};

export default function ColorControl({ label, value, onChange }) {
  const opacityLabelId = useId();
  const [color, setColor] = useState(() => parseColor(value).toFormat('hsb'));
  const [hex, setHex] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    const incoming = parseColor(value);
    setColor(previous => previous.toString('hexa') === incoming.toString('hexa') ? previous : toHSB(incoming, previous));
    setHex(serialize(incoming));
    setInvalid(false);
  }, [value]);
  const update = next => {
    if (!next) return;
    const hsb = toHSB(next, color);
    setColor(hsb);
    setHex(serialize(hsb));
    setInvalid(false);
    onChange(serialize(hsb));
  };
  const commitHex = () => {
    const candidate = hex.trim();
    if (!/^#?(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(candidate)) {
      setInvalid(true);
      return;
    }
    update(parseColor(candidate.startsWith('#') ? candidate : `#${candidate}`));
  };
  return <ColorPicker value={color} onChange={update}>
    <ColorPicker.Trigger className="color-trigger" aria-label={label}>
      <ColorSwatch size="sm" />
      <span className="color-trigger-copy"><Label>{label}</Label><span className="hex-value">{value}</span></span>
      <svg className="ui-icon color-chevron" aria-hidden="true" viewBox="0 0 20 20"><path d="m6 8 4 4 4-4" /></svg>
    </ColorPicker.Trigger>
    <ColorPicker.Popover className="color-popover" placement="bottom start">
      {/* Each control uses this component's HSB state directly. Opt out of
          ColorPicker's injected handlers to avoid duplicate state updates. */}
      <ColorArea slot={null} className="color-board" aria-label={`${label}饱和度与亮度`} colorSpace="hsb" xChannel="saturation" yChannel="brightness" value={color} onChange={update}>
        <ColorArea.Thumb />
      </ColorArea>
      <ColorSlider slot={null} aria-label={`${label}色相`} className="hue-control" colorSpace="hsb" channel="hue" value={color} onChange={update}>
        <ColorSlider.Track><ColorSlider.Thumb /></ColorSlider.Track>
      </ColorSlider>
      <ColorSlider slot={null} aria-label={`${label}不透明度`} className="opacity-control" colorSpace="hsb" channel="alpha" value={color} onChange={update}>
        <Label id={opacityLabelId}>不透明度</Label>
        <NumericValue labelledBy={opacityLabelId} value={Math.round(color.getChannelValue('alpha') * 1000) / 10}
          onChange={next => update(color.withChannelValue('alpha', next / 100))} suffix="%" />
        <ColorSlider.Track><ColorSlider.Thumb /></ColorSlider.Track>
      </ColorSlider>
      <TextField className="color-hex-field" aria-label={`${label} HEX 或 HEXA`} value={hex} onChange={next => { setHex(next); setInvalid(false); }} isInvalid={invalid} validationBehavior="aria">
        <Input placeholder="#RRGGBB / #RRGGBBAA" maxLength={9} spellCheck={false} autoComplete="off" onBlur={commitHex} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitHex(); } }} />
        {invalid && <FieldError>请输入 6 位 HEX 或 8 位 HEXA</FieldError>}
      </TextField>
      <ColorSwatchPicker slot={null} className="color-presets" aria-label={`${label}常用颜色`} value={color.withChannelValue('alpha', 1)} onChange={next => update(next.withChannelValue('alpha', color.getChannelValue('alpha')))} size="sm">
        {PRESETS.map(([preset,name]) => <ColorSwatchPicker.Item key={preset} color={preset} aria-label={name}><ColorSwatchPicker.Swatch className={preset === '#ffffff' ? 'white-swatch' : undefined} /><ColorSwatchPicker.Indicator /></ColorSwatchPicker.Item>)}
      </ColorSwatchPicker>
    </ColorPicker.Popover>
  </ColorPicker>;
}
