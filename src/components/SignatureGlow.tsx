import { useEffect, useRef } from "react";

/* Signature interaction: a soft pointer-follow glow using semantic tokens */
const SignatureGlow = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.setProperty("--x", `${x}px`);
      el.style.setProperty("--y", `${y}px`);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute -inset-32 opacity-60 blur-3xl transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at var(--x) var(--y), hsl(var(--primary)/0.25), transparent 60%)`,
        }}
      />
    </div>
  );
};

export default SignatureGlow;
