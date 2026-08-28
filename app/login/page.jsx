"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import logo from "../../assets/logos/logo.svg";
import loginArt from "../../assets/img/login.png";
import {
  getUser,
  initAuth,
  onAuth,
  signIn,
  signOut,
  signUp,
} from "../../lib/auth.js";
import { isConfigured } from "../../lib/supabase.js";
import { toast } from "../../components/toast.js";
import { modal } from "../../components/modal.js";
import { clearLibraryEdit } from "../../lib/librarystore.js";
import { resetFlow } from "../../store.js";
import { LoginField } from "./_components/LoginField.jsx";

const SIGNUP_COMPLETE_MESSAGE =
  "회원가입 요청이 정상적으로 처리되었습니다. 관리자가 확인하여 승인 후 로그인이 가능합니다.";
const SIGNUP_EMAIL_CONFIRM_MESSAGE =
  "회원가입이 완료되었습니다. 이메일 확인을 마친 후 관리자의 승인을 기다려 주세요.";
const APPROVAL_PENDING_MESSAGE =
  "관리자가 확인 중에 있습니다. 승인이 완료된 후 로그인이 가능합니다.";
const APPROVAL_REJECTED_MESSAGE =
  "가입이 승인되지 않았습니다. 계정 상태는 관리자에게 문의해 주세요.";

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState(() => getUser());
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [signupBusy, setSignupBusy] = useState(false);
  const configured = isConfigured();

  useEffect(() => {
    const unsubscribe = onAuth((nextUser) => {
      setUser(nextUser);
      if (nextUser?.status === "approved") {
        clearLibraryEdit();
        resetFlow();
        router.replace("/");
      }
    });

    initAuth().finally(() => setAuthReady(true));
    return () => {
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("instagram_error");
    if (error) toast(`Instagram 로그인에 실패했습니다: ${error}`, 6000);
    if (params.get("instagram_already_registered") === "1") {
      setActiveTab("login");
      modal("이미 가입된 계정입니다.");
    }
    if (params.get("instagram_signup_required") === "1") {
      setActiveTab("signup");
      modal("가입된 계정이 아닙니다. 회원가입을 먼저 진행해 주세요.");
    }
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setLoginError("");
    setLoginBusy(true);
    const { error, errorType, status } = await signIn(
      values.get("username"),
      values.get("password"),
    );

    if (errorType === "credentials" || errorType === "email_unconfirmed")
      setLoginError(error);
    else if (error) toast(`로그인에 실패했습니다: ${error}`, 5000);
    else if (status === "rejected") modal(APPROVAL_REJECTED_MESSAGE);
    else if (status !== "approved") modal(APPROVAL_PENDING_MESSAGE);
    setLoginBusy(false);
  }

  async function handleSignup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSignupBusy(true);
    const result = await signUp(
      values.get("username"),
      values.get("password"),
      values.get("name"),
    );
    setSignupBusy(false);

    if (result.error) {
      toast(`회원가입에 실패했습니다: ${result.error}`, 5000);
      return;
    }
    form.reset();
    modal(
      result.needsEmailConfirmation
        ? SIGNUP_EMAIL_CONFIRM_MESSAGE
        : SIGNUP_COMPLETE_MESSAGE,
    );
  }

  return (
    <section
      className="flex min-h-screen flex-col overflow-x-hidden bg-[#1a1a1a] text-white"
      aria-labelledby="login-title"
    >
      <div
        className="inline-flex items-center gap-2.5 px-[75px] pt-[53px] text-white max-[560px]:px-5 max-[560px]:pt-[22px]"
        aria-hidden="true"
      >
        <img
          className="w-auto"
          src={logo.src}
          alt="브랜드 SNS 스튜디오 로고"
        />
      </div>
      <div className="flex flex-1 items-center justify-center gap-[clamp(312px,6vw,96px)] px-10 pb-14 pt-8 max-[560px]:px-5 max-[560px]:pb-10 max-[560px]:pt-6">
        <img
          className="w-[min(36vw,440px)] drop-shadow-[0_30px_70px_rgba(94,60,200,0.28)] max-[880px]:hidden"
          src={loginArt.src}
          alt=""
          aria-hidden="true"
        />
        {!authReady ? (
          <div
            className="w-[min(100%,452px)] max-w-[479px] rounded-[28px] border border-white/[0.12] bg-white/[0.08] px-11 pb-11 pt-12 text-left shadow-[0_30px_70px_rgba(0,0,0,0.35)] backdrop-blur-[28px] max-[560px]:rounded-[22px] max-[560px]:px-6 max-[560px]:py-9"
            aria-live="polite"
          >
            <h1
              id="login-title"
              className="text-[30px] font-bold leading-[22.4px] text-white"
            >
              로그인 확인 중
            </h1>
            <p className="mt-2.5 text-lg font-[350] leading-[22.4px] text-white/[0.68]">
              계정 상태를 확인하고 있습니다.
            </p>
          </div>
        ) : user && user.status !== "approved" ? (
          <AccountStatus user={user} />
        ) : (
          <div className="w-[min(100%,452px)] max-w-[479px] rounded-[28px] border border-white/[0.12] bg-white/[0.08] px-11 pb-11 pt-12 text-left shadow-[0_30px_70px_rgba(0,0,0,0.35)] backdrop-blur-[28px] max-[560px]:rounded-[22px] max-[560px]:px-6 max-[560px]:py-9">
            <h1
              id="login-title"
              className="text-[30px] font-bold leading-[22.4px] text-white"
            >
              로그인
            </h1>
            <p className="mt-2.5 text-lg font-[350] leading-[22.4px] text-white/[0.68]">
              승인된 계정으로 로그인해 주세요.
            </p>
            <div
              className="mt-7 grid grid-cols-2 rounded-full bg-white p-1"
              role="tablist"
              aria-label="계정 메뉴"
            >
              <button
                className={`cursor-pointer rounded-full border-0 px-0 py-3 text-[15px] font-bold transition-colors ${activeTab === "login" ? "bg-[#191f28] text-white" : "bg-transparent text-[#191f28] hover:bg-black/6"}`}
                type="button"
                role="tab"
                aria-selected={activeTab === "login"}
                onClick={() => {
                  setActiveTab("login");
                  setLoginError("");
                }}
              >
                로그인
              </button>
              <button
                className={`cursor-pointer rounded-full border-0 px-0 py-3 text-[15px] font-bold transition-colors ${activeTab === "signup" ? "bg-[#191f28] text-white" : "bg-transparent text-[#191f28] hover:bg-black/6"}`}
                type="button"
                role="tab"
                aria-selected={activeTab === "signup"}
                onClick={() => {
                  setActiveTab("signup");
                  setLoginError("");
                }}
              >
                회원가입
              </button>
            </div>

            {activeTab === "login" ? (
              <div>
              <InstagramAuthButton intent="login" />
              <AuthDivider />
              <form
                className="flex flex-col text-left"
                onSubmit={handleLogin}
                onInput={() => setLoginError("")}
              >
                <LoginField
                  label="아이디"
                  name="username"
                  autoComplete="username"
                  maxLength={64}
                  pattern="[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+"
                  title="이메일 도메인을 제외한 아이디만 입력해 주세요"
                  placeholder="아이디를 입력해 주세요"
                />
                <LoginField
                  label="비밀번호"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  minLength={6}
                  placeholder="비밀번호를 입력해 주세요"
                />
                <p
                  className="mt-3.5 text-sm font-semibold leading-[1.5] text-[#ff8a80]"
                  role="alert"
                  aria-live="polite"
                  hidden={!loginError}
                >
                  {loginError}
                </p>
                <button
                  className="mt-11 h-[51px] rounded-full border-0 bg-white px-[55px] py-2.5 text-xl font-bold leading-[22.4px] text-black"
                  type="submit"
                  disabled={!configured || loginBusy}
                >
                  {loginBusy ? "로그인 중…" : "로그인"}
                </button>
              </form>
              </div>
            ) : (
              <div>
              <InstagramAuthButton intent="signup" />
              <AuthDivider />
              <form className="flex flex-col text-left" onSubmit={handleSignup}>
                <LoginField
                  label="아이디"
                  name="username"
                  autoComplete="username"
                  maxLength={64}
                  pattern="[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+"
                  title="이메일 도메인을 제외한 아이디만 입력해 주세요"
                  placeholder="사용할 아이디를 입력해 주세요"
                />
                <LoginField
                  label="이름"
                  name="name"
                  autoComplete="name"
                  maxLength={50}
                  placeholder="이름을 입력해 주세요"
                />
                <LoginField
                  label="비밀번호"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  placeholder="비밀번호를 입력해 주세요"
                />
                <button
                  className="mt-11 h-[51px] rounded-full border-0 bg-white px-[55px] py-2.5 text-xl font-bold leading-[22.4px] text-black"
                  type="submit"
                  disabled={!configured || signupBusy}
                >
                  {signupBusy ? "가입 중…" : "회원가입"}
                </button>
                <p className="mt-4 text-center text-[13px] leading-relaxed text-white/60">
                  가입 후 관리자의 승인이 완료되어야 서비스를 이용할 수
                  있습니다.
                </p>
              </form>
              </div>
            )}
            {!configured && (
              <p
                className="mt-4 text-[13px] leading-relaxed text-[#ffd166]"
                role="alert"
              >
                Supabase 연결 정보가 설정되지 않았습니다.
              </p>
            )}
          </div>
        )}
      </div>
      <div
        id="toast-root"
        className="toast-root"
        role="status"
        aria-live="polite"
      />
    </section>
  );
}

function InstagramAuthButton({ intent }) {
  const isSignup = intent === "signup";
  return (
    <button
      type="button"
      onClick={() => { window.location.href = `/api/auth/instagram/start?intent=${intent}`; }}
      className="mt-7 flex h-[51px] w-full items-center justify-center gap-2 rounded-full border-0 bg-gradient-to-r from-[#833ab4] via-[#e1306c] to-[#f77737] px-5 text-[17px] font-bold text-white transition hover:brightness-110"
    >
      Instagram으로 {isSignup ? "회원가입하기" : "로그인하기"}
    </button>
  );
}

function AuthDivider() {
  return <div className="my-5 flex items-center gap-3 text-[12px] text-white/50 before:h-px before:flex-1 before:bg-white/20 after:h-px after:flex-1 after:bg-white/20">또는</div>;
}

function AccountStatus({ user }) {
  const rejected = user.status === "rejected";
  const profileError = Boolean(user.profileError);
  const title = profileError
    ? "승인 상태를 확인하지 못했습니다"
    : rejected
      ? "가입이 승인되지 않았습니다"
      : "관리자 승인 대기 중입니다";
  const description = profileError
    ? "잠시 후 다시 확인해 주세요. 계속되면 users 테이블의 계정 ID와 RLS 정책을 확인해 주세요."
    : rejected
      ? "계정 상태에 관해 문의하려면 관리자에게 연락해 주세요."
      : "승인이 완료되면 상태를 다시 확인해 주세요.";

  return (
    <div className="w-[min(100%,452px)] max-w-[479px] rounded-[28px] border border-white/[0.12] bg-white/[0.08] px-11 pb-11 pt-12 text-left shadow-[0_30px_70px_rgba(0,0,0,0.35)] backdrop-blur-[28px] max-[560px]:rounded-[22px] max-[560px]:px-6 max-[560px]:py-9">
      <h1 id="login-title" className="text-[30px] font-bold leading-[22.4px] text-white">
        {title}
      </h1>
      <p className="mt-2.5 text-lg font-[350] leading-[22.4px] text-white/[0.68]">
        {description}
      </p>
      <p className="mt-[18px] font-bold [overflow-wrap:anywhere]">
        {user.name}
      </p>
      <div className="mt-7 flex flex-col gap-2.5">
        <button
          className="h-[43px] w-full cursor-pointer rounded-full border-0 bg-white text-xl text-[#191f28] transition hover:bg-[#ececec] active:scale-[0.98]"
          type="button"
          onClick={() => location.reload()}
        >
          상태 다시 확인
        </button>
        <button
          className="h-[43px] w-full cursor-pointer rounded-full border border-white/40 bg-transparent text-xl text-white transition hover:bg-white/8 active:scale-[0.98]"
          type="button"
          onClick={() => signOut()}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
