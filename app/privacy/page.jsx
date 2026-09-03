export const metadata = {
  title: "개인정보처리방침",
  description: "브랜드 SNS 스튜디오 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: "860px",
        margin: "0 auto",
        padding: "60px 24px 100px",
        lineHeight: "1.8",
        color: "white",
        wordBreak: "keep-all",
      }}
    >
      <h1
        style={{
          fontSize: "32px",
          fontWeight: "700",
          marginBottom: "40px",
        }}
      >
        개인정보처리방침
      </h1>

      <p>
        브랜드 SNS 스튜디오(이하 &quot;서비스&quot;)는 이용자의 개인정보를
        중요하게 생각하며, 관련 법령을 준수하여 개인정보를 처리하고 있습니다.
        서비스는 브랜드 관련 상품의 SNS 게시물(문구·이미지·카드뉴스)을 만들고,
        이용자가 원하는 경우 Instagram 계정에 직접 게시할 수 있도록 돕는 내부용
        제작 도구입니다.
      </p>

      <p>
        본 개인정보처리방침은 서비스 이용 및 Instagram 계정 연동·게시 기능을
        이용하는 과정에서 어떠한 정보를 수집·이용하고, 이를 어떻게 관리하는지
        설명합니다.
      </p>

      <Section title="1. 수집하는 개인정보">
        <h3>1) 회원가입·로그인 과정에서 수집되는 정보</h3>
        <List
          items={[
            "아이디(이메일 형식) 및 비밀번호",
            "이름",
            "계정 승인 상태(관리자 승인 여부)",
          ]}
        />
        <p>
          서비스는 관리자가 가입을 승인한 계정만 이용할 수 있는 승인제로
          운영됩니다. 회원가입 시 입력한 정보는 인증 서비스(Supabase Auth)를
          통해 저장·관리됩니다.
        </p>

        <h3>2) Instagram으로 로그인·회원가입하는 경우</h3>
        <p>
          이용자가 Instagram 계정으로 로그인 또는 회원가입하는 경우, Meta 및
          Instagram API를 통해 이용자가 허용한 범위 내에서 다음과 같은 정보를
          제공받습니다.
        </p>
        <List
          items={[
            "Instagram 사용자 ID 및 사용자 이름(username)",
            "Instagram 계정 유형(account type)",
            "Instagram 프로필 사진 URL",
            "서비스 접속을 위한 액세스 토큰(장기 토큰) 및 만료 시각",
          ]}
        />
        <p>
          Instagram으로 처음 로그인하는 경우, 서비스는 이용자를 식별하기 위해
          실제로 사용하지 않는 형태의 내부 식별용 이메일 주소를 자동으로
          생성하여 계정에 연결합니다. 이 이메일 주소는 실제 수신 기능이 없으며
          서비스 내부 식별 용도로만 사용됩니다.
        </p>

        <h3>3) Instagram 계정을 연결·게시에 사용하는 경우</h3>
        <p>
          이용자가 로그인 후 마이페이지에서 별도로 Instagram 계정을 연결하는
          경우에도 위 2)항과 동일한 정보를 제공받아 저장하며, 이 정보는 이용자가
          서비스에서 만든 게시물을 해당 Instagram 계정에 게시하는 데 사용됩니다.
        </p>

        <h3>4) 서비스 이용 과정에서 생성·수집되는 정보</h3>
        <List
          items={[
            "이용자가 입력한 상품·주제·톤 등 게시물 제작 조건",
            "이용자가 작성하거나 AI로 생성한 문구, 업로드한 이미지 등 콘텐츠",
            "이용자가 참고용으로 입력한 네이버 블로그 글 URL 및 그 공개 본문",
            "서비스 이용 기록, 접속 기록 및 오류 로그",
          ]}
        />
        <p>
          실제 제공받는 정보의 범위는 이용자가 Meta 또는 Instagram에서 허용한
          권한 및 서비스가 사용하는 API 권한에 따라 달라질 수 있습니다.
        </p>
      </Section>

      <Section title="2. 개인정보의 이용 목적">
        <p>서비스는 수집하거나 제공받은 정보를 다음 목적으로 이용합니다.</p>

        <List
          items={[
            "이용자 식별, 계정 관리 및 관리자 승인 여부 확인",
            "Instagram 계정을 통한 로그인·회원가입 처리",
            "이용자가 연결한 Instagram 계정 확인 및 관리",
            "이용자가 요청한 게시물을 Instagram 계정에 게시",
            "이용자가 입력한 조건을 바탕으로 한 게시물 문구·카드뉴스 생성(AI 문구 생성 포함)",
            "이용자가 만든 콘텐츠의 저장·조회(마이페이지·보관함)",
            "서비스 오류 확인 및 안정적인 서비스 운영",
            "부정 이용 방지 및 서비스 보안",
          ]}
        />

        <p>
          Instagram 계정에서 제공받은 정보는 이용자가 요청한 로그인 및 게시
          기능을 제공하기 위한 목적으로만 사용하며, 그 외의 목적으로 이용하지
          않습니다.
        </p>
      </Section>

      <Section title="3. Instagram API 및 Meta 플랫폼 이용">
        <p>
          서비스는 Instagram 로그인 및 게시 기능을 제공하기 위해 Meta Platforms,
          Inc.에서 제공하는 Instagram API(Instagram Login, Content Publishing)를
          사용합니다.
        </p>

        <p>
          이용자가 Instagram 계정 연결을 선택하는 경우 Meta의 인증 및 권한 승인
          절차를 거치게 되며, 이용자가 승인한 권한 범위(계정 기본 정보 조회,
          콘텐츠 게시) 내에서만 Instagram 관련 정보에 접근합니다.
        </p>

        <p>
          서비스는 이용자가 화면에서 직접 &quot;Instagram에 게시&quot;를
          실행하는 경우에만 해당 이용자의 Instagram 계정에 이미지·캡션을
          게시하며, 이용자의 명시적인 요청 없이 임의로 게시하지 않습니다.
        </p>

        <p>
          Instagram API를 통해 제공받은 정보는 서비스 제공 및 이용자가 요청한
          기능(로그인, 게시) 수행을 위해서만 사용합니다.
        </p>
      </Section>

      <Section title="4. 액세스 토큰의 관리">
        <p>Instagram API 이용을 위해 이용자 계정별 액세스 토큰이 사용됩니다.</p>

        <p>
          액세스 토큰은 데이터베이스(Supabase)에 저장되며, 서버에서만 접근할 수
          있고 Instagram 로그인 및 게시 기능 제공 목적으로만 사용합니다.
        </p>

        <p>
          이용자가 마이페이지에서 Instagram 계정 연동을 해제하거나
          Meta·Instagram에서 서비스에 부여한 권한을 취소하는 경우, 해당 토큰은
          더 이상 사용되지 않으며 서비스가 보관 중인 토큰도 함께 삭제됩니다.
        </p>
      </Section>

      <Section title="5. 개인정보의 보유 및 이용기간">
        <p>
          서비스는 개인정보의 수집 및 이용 목적이 달성된 후 해당 정보를 지체
          없이 삭제하는 것을 원칙으로 합니다.
        </p>

        <p>
          회원 정보 및 Instagram 연동 정보는 회원 탈퇴, 계정 연동 해제 또는
          이용자의 삭제 요청 시까지 보유하며, 요청이 접수되면 관련 법령상 보관
          의무가 없는 한 지체 없이 삭제합니다.
        </p>

        <p>
          이용자가 만든 게시물(문구·이미지 등)은 이용자가 보관함에서 직접
          삭제하거나 회원 탈퇴를 요청할 때까지 보관됩니다.
        </p>
      </Section>

      <Section title="6. 개인정보의 제3자 제공">
        <p>
          서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
        </p>

        <p>다만 다음의 경우에는 예외로 할 수 있습니다.</p>

        <List
          items={[
            "이용자가 사전에 동의한 경우",
            "이용자가 요청한 Instagram 게시를 처리하기 위해 Meta·Instagram 시스템에 필요한 정보(이미지 URL, 캡션, 액세스 토큰)를 전달하는 경우",
            "법령에 따라 제공 의무가 있는 경우",
          ]}
        />
      </Section>

      <Section title="7. 개인정보 처리의 위탁">
        <p>서비스는 아래와 같은 외부 서비스를 이용해 기능을 제공합니다.</p>

        <List
          items={[
            "Supabase — 회원 인증, 계정 정보 및 Instagram 연동 정보 저장",
            "OpenAI — 이용자가 입력한 조건을 바탕으로 한 게시물 문구 생성",
            "Meta Platforms, Inc.(Instagram API) — Instagram 로그인 및 게시물 게시",
          ]}
        />

        <p>
          위 서비스에는 처리 목적(문구 생성, 게시)에 필요한 최소한의 정보만
          전달되며, 각 서비스는 자체 정책에 따라 정보를 처리합니다. 서비스는
          관련 법령에 따라 개인정보가 안전하게 관리될 수 있도록 필요한 조치를
          취합니다.
        </p>
      </Section>

      <Section title="8. 개인정보의 파기">
        <p>
          개인정보의 보유 목적이 달성되거나 보유기간이 종료된 경우 해당
          개인정보를 지체 없이 파기합니다.
        </p>

        <p>
          전자적 파일 형태의 개인정보는 복구 또는 재생하기 어려운 방법으로
          삭제합니다.
        </p>
      </Section>

      <Section title="9. Instagram 연동 해제 및 데이터 삭제 요청">
        <p>
          이용자는 언제든지 마이페이지에서 Instagram 계정 연동을 해제하거나,
          Meta 또는 Instagram 설정에서 서비스에 부여한 권한을 직접 해제할 수
          있습니다.
        </p>

        <p>
          또한 서비스가 보유하고 있는 계정 정보, Instagram 연동 정보 및 이용자가
          만든 게시물의 삭제를 요청할 수 있습니다.
        </p>

        <p>
          데이터 삭제를 원하는 이용자는 아래 개인정보 관련 문의처를 통해 삭제를
          요청할 수 있습니다.
        </p>

        <p>
          삭제 요청이 접수되면 관련 법령에 따라 보관해야 하는 정보를 제외하고
          해당 이용자와 관련된 개인정보 및 Instagram 연동 정보를 확인하여
          삭제합니다.
        </p>

        <InfoBox>
          <strong>데이터 삭제 요청 문의</strong>
          <br />
          이메일: qosuh58@gmail.com
        </InfoBox>
      </Section>

      <Section title="10. 이용자의 권리">
        <p>
          이용자는 자신의 개인정보에 대해 다음과 같은 권리를 행사할 수 있습니다.
        </p>

        <List
          items={[
            "개인정보 열람 요청",
            "개인정보 수정 요청",
            "개인정보 삭제 요청",
            "개인정보 처리 정지 요청",
            "Instagram 계정 연동 해제",
          ]}
        />

        <p>관련 요청은 아래 개인정보 관련 문의처를 통해 접수할 수 있습니다.</p>
      </Section>

      <Section title="11. 개인정보의 안전성 확보 조치">
        <p>
          서비스는 개인정보의 안전한 처리를 위해 필요한 기술적·관리적 보호조치를
          시행합니다.
        </p>

        <List
          items={[
            "관리자 승인을 거친 계정만 서비스 이용 및 API 호출 가능",
            "액세스 토큰 등 인증정보는 서버에서만 접근 가능하도록 관리",
            "개인정보 전송 시 HTTPS 등 암호화 통신 사용",
            "OAuth 인증 과정의 상태값(state) 검증을 통한 위·변조 방지",
          ]}
        />
      </Section>

      <Section title="12. 외부 서비스에 관한 사항">
        <p>
          서비스에서 Instagram 또는 Meta의 로그인·인증 화면으로 이동하거나 해당
          서비스를 이용하는 경우 해당 외부 서비스의 개인정보처리방침 및
          이용약관이 적용될 수 있습니다.
        </p>

        <p>
          서비스는 이용자가 외부 서비스에서 직접 제공하는 개인정보 처리에
          대해서는 해당 서비스의 정책이 적용됨을 안내합니다.
        </p>
      </Section>

      <Section title="13. 개인정보 보호 관련 문의">
        <p>
          개인정보 처리 및 Instagram 연동 정보에 관한 문의는 아래 연락처를 통해
          접수할 수 있습니다.
        </p>

        <InfoBox>
          서비스명: 브랜드 SNS 스튜디오
          <br />
          운영자: 브랜드 SNS 스튜디오
          <br />
          개인정보 관련 문의 이메일: soohyun@openxgroup.co.kr
        </InfoBox>
      </Section>

      <Section title="14. 개인정보처리방침의 변경">
        <p>
          본 개인정보처리방침은 관련 법령, 서비스 기능 또는 개인정보 처리 방식의
          변경에 따라 수정될 수 있습니다.
        </p>

        <p>
          중요한 내용이 변경되는 경우 서비스 내 공지 또는 기타 적절한 방법을
          통해 안내합니다.
        </p>
      </Section>

      <p
        style={{
          marginTop: "60px",
          paddingTop: "24px",
          borderTop: "1px solid #ddd",
          color: "#666",
        }}
      >
        시행일: 2026년 9월 3일
      </p>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginTop: "48px" }}>
      <h2
        style={{
          fontSize: "22px",
          fontWeight: "700",
          marginBottom: "20px",
        }}
      >
        {title}
      </h2>

      <div>{children}</div>
    </section>
  );
}

function List({ items }) {
  return (
    <ul
      style={{
        paddingLeft: "24px",
        margin: "16px 0",
      }}
    >
      {items.map((item) => (
        <li key={item} style={{ marginBottom: "6px" }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function InfoBox({ children }) {
  return (
    <div
      style={{
        marginTop: "20px",
        padding: "20px",
        background: "rgba(255,255,255,0.08)",
        borderRadius: "8px",
      }}
    >
      {children}
    </div>
  );
}
