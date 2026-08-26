export function Events({ events }) {
  return (
    <div>
      <h3 className="text-[18px] font-bold text-white">행사 일정</h3>
      <ul className="mt-2.5 flex flex-col gap-2 text-[14px]">
        {events.map((event) => (
          <li
            key={`${event.name}-${event.date}`}
            className="flex items-start gap-2.5"
          >
            <span className="mt-0.5 shrink-0 rounded-full bg-white/16 px-[11px] py-1 text-[12px] font-bold">
              {event.status === "open" ? "진행 예정" : "종료"}
            </span>
            <span>
              <strong>{event.name}</strong>
              <br />
              <span className="text-[13px] text-white/62">
                {event.date} · {event.desc}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
