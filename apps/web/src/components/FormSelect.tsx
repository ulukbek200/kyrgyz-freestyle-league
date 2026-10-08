import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { Select, type RefSelectProps, type SelectProps } from 'antd';

// rc-select copies Form.Item's aria-required to both the input and a generic div.
// Keep the semantic attribute on the actual combobox, where it is valid.
export const FormSelect = forwardRef<RefSelectProps, SelectProps>((props, forwardedRef) => {
  const ref = useRef<RefSelectProps>(null);
  useImperativeHandle(forwardedRef, () => ref.current!);
  useLayoutEffect(() => { ref.current?.nativeElement?.removeAttribute('aria-required'); });
  return <Select {...props} ref={ref} />;
});
FormSelect.displayName = 'FormSelect';
