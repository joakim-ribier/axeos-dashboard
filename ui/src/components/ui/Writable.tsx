// src/components/ui/Writable.tsx

interface WritableProps {
  /** true = render nothing. Named for the condition under which content is
   * hidden, not shown, since every call site is gating a write affordance
   * (a Save button, an add/remove form, an action column) that a read-only
   * view has no business rendering at all. */
  readOnly: boolean;
  children: React.ReactNode;
}

/**
 * Renders `children` unless `readOnly` is true, in which case it renders
 * nothing. The explicit alternative to a bare `{!readOnly && (...)}` inline
 * in JSX -- reads as a deliberate visibility gate rather than a condition
 * that could be mistaken for business logic, and gives every read-only
 * exclusion on a page the same recognizable shape.
 */
export const Writable = ({ readOnly, children }: WritableProps) => {
  if (readOnly) return null;
  return <>{children}</>;
};
