import { Icon } from "../Icon.jsx";

export function ChannelTabs({ channels, activeId, onSelect }) {
  return (
    <div
      className="flex flex-wrap gap-2.5"
      role="tablist"
      aria-label="채널별 글귀"
    >
      {channels.map((channel) => (
        <button
          key={channel.id}
          id={`tab-${channel.id}`}
          role="tab"
          aria-selected={channel.id === activeId}
          onClick={() => onSelect(channel.id)}
          className={`inline-flex h-[45px] items-center gap-[5px] rounded-full border px-[19px] text-[15px] font-bold transition ${channel.id === activeId ? "border-[#287aff] bg-[#287aff] text-white" : "border-[#e5e8eb] bg-white text-[#5f6b7a] hover:bg-[#f7f8fa]"}`}
        >
          <Icon name={channel.icon} className="size-[18px]" />
          {channel.name}
        </button>
      ))}
    </div>
  );
}
