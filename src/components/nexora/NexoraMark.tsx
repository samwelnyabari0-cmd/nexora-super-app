export function NexoraMark({ className = "" }: { className?: string }) {
  return (
    <img
      src="/nexora-icon.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`block shrink-0 object-contain ${className}`}
    />
  );
}
