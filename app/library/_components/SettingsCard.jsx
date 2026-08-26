import Link from "next/link";
import { Icon } from "../../_components/Icon.jsx";

export function SettingsCard({ path, iconName, label, desc }) {
  return (
    <Link
      href={path}
      aria-label={`${label} 설정 열기`}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[15px] border border-[#e5e8eb] bg-white px-5 py-[18px] transition hover:border-[#1b64da]"
    >
      <span className="text-[#191f28]">
        <Icon name={iconName} className="size-6 stroke-[1.75]" />
      </span>
      <span className="min-w-0">
        <strong className="block text-[16px] font-bold text-[#191f28]">
          {label}
        </strong>
        <span className="mt-0.5 block text-[13px] text-[#5f6b7a]">
          {desc}
        </span>
      </span>
      <Icon name="arrowRight" className="size-[18px] text-[#5f6b7a]" />
    </Link>
  );
}
