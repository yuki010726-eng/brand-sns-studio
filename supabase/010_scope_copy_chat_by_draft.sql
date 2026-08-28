-- 010: 챗봇 대화를 AI 생성 시안별로 분리한다.
-- 기존 대화는 global 범위에 남겨 두고, 새 UI에서는 시안 식별 키로 조회한다.

alter table public.copy_chat_messages
  add column if not exists context_key text not null default 'global';

create index if not exists copy_chat_messages_context_idx
  on public.copy_chat_messages(user_id, context_key, created_at);
