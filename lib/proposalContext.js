/**
 * Per-user, per-product proposal fact sheet.
 *
 * The original proposal is expensive to attach to the model on every topic.
 * Store only the extracted factual summary, scoped to the signed-in user, so
 * changing a topic can reuse it without sending the file again.
 */
import { getClient } from './supabase.js';
import { getUser } from './auth.js';

const TABLE = 'user_product_proposal_contexts';
const sourceUrlOf = (product) => String(product?.proposal_url || product?.site || '').trim();

export async function readProposalContext(product) {
  const user = getUser();
  const client = await getClient();
  const productId = String(product?.id || '').trim();
  if (!user?.id || !client || !productId) return null;

  const { data, error } = await client
    .from(TABLE)
    .select('proposal_url, context')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .maybeSingle();
  if (error) {
    // The migration may not have been run yet. Generation must remain usable.
    console.warn('[proposal-context] read failed', error.message);
    return null;
  }

  // A changed proposal must be analysed again; never reuse facts from an old file.
  if (String(data?.proposal_url || '').trim() !== sourceUrlOf(product)) return null;
  const context = String(data?.context || '').trim();
  return context || null;
}

export async function saveProposalContext(product, context) {
  const user = getUser();
  const client = await getClient();
  const productId = String(product?.id || '').trim();
  const proposalUrl = sourceUrlOf(product);
  const value = String(context || '').trim();
  if (!user?.id || !client || !productId || !proposalUrl || !value) return false;

  const { error } = await client.from(TABLE).upsert({
    user_id: user.id,
    product_id: productId,
    proposal_url: proposalUrl,
    context: value,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,product_id' });
  if (error) {
    console.warn('[proposal-context] save failed', error.message);
    return false;
  }
  return true;
}

/** Return saved facts first; analyse and persist only on the first use. */
export async function getOrCreateProposalContext(product, extract, opts = {}) {
  const cached = await readProposalContext(product);
  if (cached) return { context: cached, cached: true };
  const context = await extract({ product }, opts);
  // A DB write failure should not throw away a successful generation.
  await saveProposalContext(product, context);
  return { context, cached: false };
}
