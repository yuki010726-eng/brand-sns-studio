import { SettingsCard } from "./SettingsCard.jsx";

/**
 * 계정 설정으로 들어가는 자리 (2026-08-21, 요청자 지시).
 *
 * 프로필·블로그 스타일은 게시물마다 하는 일이 아니라 계정을 한 번 잡는 설정이라
 * 「저장한 게시물」과 한 화면에 모아 둔다.
 *
 * ⚠️ 경로(`/profile`·`/research`)는 그대로다. 화면을 옮긴 게 아니라 들어가는 문만 옮겼다.
 */
const SETTINGS = [
  {
    path: "/profile",
    iconName: "user",
    label: "프로필",
    desc: "인스타 계정 이름·소개·프로필 이미지 프롬프트를 만듭니다.",
  },
  {
    path: "/research",
    iconName: "search",
    label: "블로그 스타일",
    desc: "잘 쓴 블로그의 문체를 모아 두고 글을 쓸 때 골라 씁니다.",
  },
];

export function SettingsList() {
  return (
    <ul className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
      {SETTINGS.map((item) => (
        <li key={item.path}>
          <SettingsCard {...item} />
        </li>
      ))}
    </ul>
  );
}
