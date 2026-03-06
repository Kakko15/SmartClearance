import { useRef, useState } from "react";

export default function SpotlightBorder({
  children,
  isDark = false,
  error = false,
  className = "",
}) {
  const divRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  const borderColor = error
    ? "border-red-500"
    : isDark
      ? "border-green-400"
      : "border-green-500";

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-xl ${className}`}
    >
      {children}
      <div
        className={`pointer-events-none absolute inset-0 rounded-xl border-2 ${borderColor} transition-opacity duration-300`}
        style={{
          opacity,
          maskImage: `radial-gradient(120px circle at ${position.x}px ${position.y}px, black, transparent)`,
          WebkitMaskImage: `radial-gradient(120px circle at ${position.x}px ${position.y}px, black, transparent)`,
        }}
      />
    </div>
  );
}
