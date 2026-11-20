import { useEffect, useId, useRef } from 'react';
import { Label, Slider } from '@heroui/react';
import NumericValue from './NumericValue.jsx';

// Keep React Aria's gesture handling, and give its pointerup/cancel listeners
// a captured target when the pointer leaves a track or an embedded browser.
export function GestureBoundary({ children }) {
  const active = useRef(null);
  const finish = () => {
    const gesture = active.current;
    active.current = null;
    if (gesture?.element.hasPointerCapture?.(gesture.id)) {
      gesture.element.releasePointerCapture(gesture.id);
    }
  };
  const cancel = () => {
    const gesture = active.current;
    if (!gesture) return;
    active.current = null;
    const event = new PointerEvent('pointercancel', {
      bubbles: true, pointerId: gesture.id, pointerType: gesture.type,
    });
    // React Aria owns the dragging state and removes its listeners on cancel.
    const target = gesture.element.isConnected ? gesture.element : window;
    target.dispatchEvent(event);
    // React Aria's thumb also registers a pointerup listener before the first
    // move; complete that listener when cancellation happens without movement.
    target.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, pointerId: gesture.id, pointerType: gesture.type, button: 0, buttons: 0,
    }));
    if (gesture.element.hasPointerCapture?.(gesture.id)) gesture.element.releasePointerCapture(gesture.id);
  };
  useEffect(() => {
    const onMove = event => {
      if (active.current?.id === event.pointerId && event.pointerType === 'mouse' && event.buttons === 0) cancel();
    };
    const onHidden = () => { if (document.hidden) cancel(); };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      cancel();
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, []);
  return <div className="gesture-boundary"
    onPointerDownCapture={event => {
      if (event.button !== 0) return;
      const element = event.target.closest?.('[data-slot="slider-thumb"], [data-slot="slider-track"], [data-slot="color-area"], [data-slot="color-slider-track"], [data-slot="color-slider-thumb"]');
      if (!element) return;
      if (active.current) cancel();
      active.current = { element, id: event.pointerId, type: event.pointerType };
      try { element.setPointerCapture(event.pointerId); } catch { /* Capture is unavailable for synthetic events. */ }
    }}
    onPointerUpCapture={event => { if (active.current?.id === event.pointerId) finish(); }}
    onPointerCancelCapture={event => { if (active.current?.id === event.pointerId) cancel(); }}
    onLostPointerCapture={event => { if (active.current?.id === event.pointerId) cancel(); }}
  >{children}</div>;
}

export default function RangeControl({ label, value, onChange, className = '', isDisabled = false, suffix = '' }) {
  const labelId = useId();
  return <Slider className={`parameter ${className}`} value={value}
    onChange={next => typeof next === 'number' && onChange(next)}
    minValue={0} maxValue={100} step={0.1} isDisabled={isDisabled}>
    <Label id={labelId}>{label}</Label>
    <NumericValue labelledBy={labelId} value={value} onChange={onChange} suffix={suffix} isDisabled={isDisabled} />
    <Slider.Track><Slider.Fill /><Slider.Thumb /></Slider.Track>
  </Slider>;
}
