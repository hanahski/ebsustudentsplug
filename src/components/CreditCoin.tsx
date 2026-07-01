import coinImg from "@/assets/credit-coin.png";
import { cn } from "@/lib/utils";

/** The StudentsPlug credit coin — used wherever we display a credit balance/icon. */
export function CreditCoin({ size = 20, className, spin }: { size?: number; className?: string; spin?: boolean }) {
  return (
    <img
      src={coinImg}
      alt="Credit coin"
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      className={cn("inline-block select-none drop-shadow-sm", spin && "sp-coin-spin", className)}
      style={{ width: size, height: size }}
    />
  );
}
