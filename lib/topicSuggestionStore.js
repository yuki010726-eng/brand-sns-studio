import { getClient } from './supabase.js';
import { getUser } from './auth.js';

const TABLE = 'user_product_topic_suggestions';
const sourceUrlOf = (product) => String(product?.proposal_url || product?.site || '').trim();

export async function readTopicSuggestions(product) {
  const user = getUser();
  const client = await getClient();
  const productId = String(product?.id || '').trim();
  if (!user?.id || !client || !productId) return null;
  const { data, error } = await client.from(TABLE)
    .select('source_url, topics')
    .eq('user_id', user.id).eq('product_id', productId).maybeSingle();
  if (error) {
    console.warn('[topic-suggestions] read failed', error.message);
    return null;
  }
  if (String(data?.source_url || '').trim() !== sourceUrlOf(product)) return null;
  return Array.isArray(data?.topics) ? data.topics.map((topic) => String(topic).trim()).filter(Boolean) : null;
}

export async function saveTopicSuggestions(product, topics) {
  const user = getUser();
  const client = await getClient();
  const productId = String(product?.id || '').trim();
  const sourceUrl = sourceUrlOf(product);
  const value = Array.isArray(topics) ? topics.map((topic) => String(topic).trim()).filter(Boolean) : [];
  if (!user?.id || !client || !productId || !sourceUrl || !value.length) return false;
  const { error } = await client.from(TABLE).upsert({
    user_id: user.id, product_id: productId, source_url: sourceUrl, topics: value,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,product_id' });
  if (error) {
    console.warn('[topic-suggestions] save failed', error.message);
    return false;
  }
  return true;
}
