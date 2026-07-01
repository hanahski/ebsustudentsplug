import brandLogo from "@/assets/brand-logo.png";

export function Logo({ size = 44 }: { size?: number }) {
  return (
    <img
      src={brandLogo}
      alt="StudentsPlug"
      width={size}
      height={size}
      className="object-contain shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
