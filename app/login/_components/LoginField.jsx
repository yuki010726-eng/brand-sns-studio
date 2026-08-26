export function LoginField({ label, type = 'text', ...inputProps }) {
  return (
    <label className="mt-[26px] flex flex-col gap-2.5">
      <span className="text-lg font-[350] leading-[22.4px] text-white">{label}</span>
      <input className="h-[51px] w-full rounded-full border-0 bg-white px-[22px] text-lg font-[350] leading-[22.4px] text-[#191f28] placeholder:text-[#b8b8b8] focus-visible:rounded-full focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#3182f6]" type={type} required {...inputProps} />
    </label>
  );
}
