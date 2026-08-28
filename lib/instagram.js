import { accessToken } from './auth.js';
import { getClient } from './supabase.js';
import { getActiveInstagramAccountId } from './instagram-accounts.js';

const BUCKET = 'instagram-publish';

const safePart = (value) => String(value || 'card').replace(/[^a-zA-Z0-9_-]/g, '-');

export async function uploadInstagramCards(blobs, postId) {
  const sb = await getClient();
  if (!sb) throw new Error('이미지 저장소에 연결할 수 없습니다.');

  const { data: sessionData } = await sb.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error('로그인이 필요합니다.');

  const batchId = `${Date.now()}-${crypto.randomUUID()}`;
  const paths = [];
  const urls = [];

  try {
    for (let index = 0; index < blobs.length; index += 1) {
      const path = `${userId}/${safePart(postId)}/${batchId}/${String(index + 1).padStart(2, '0')}.png`;
      const { error } = await sb.storage.from(BUCKET).upload(path, blobs[index], {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      paths.push(path);
      const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return { paths, urls };
  } catch (error) {
    if (paths.length) await sb.storage.from(BUCKET).remove(paths).catch(() => {});
    throw new Error(error?.message || '게시용 이미지를 업로드하지 못했습니다.');
  }
}

export async function removeInstagramCards(paths) {
  if (!paths?.length) return;
  const sb = await getClient();
  if (sb) await sb.storage.from(BUCKET).remove(paths).catch(() => {});
}

export async function publishInstagramCarousel(imageUrls, caption) {
  const token = await accessToken();
  if (!token) throw new Error('로그인이 필요합니다.');

  const response = await fetch('/api/instagram/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Instagram-Account-Id': getActiveInstagramAccountId(),
    },
    body: JSON.stringify({ imageUrls, caption }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Instagram 게시에 실패했습니다 (${response.status}).`);
  return body;
}
