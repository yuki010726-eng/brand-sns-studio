import { requirePost, requireApprovedUser, fail } from '../_shared.mjs';
import { canonicalBlogUrl, mobileBlogUrl, pdfName } from './_shared.mjs';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  const auth = await requireApprovedUser(req);
  if (!auth.ok) return fail(res, auth.status, auth.message);
  const url = canonicalBlogUrl(req.body?.url);
  if (!url) return fail(res, 400, '올바른 네이버 블로그 주소가 아닙니다.');

  let browser;
  try {
    const [{ chromium: playwright }, { default: chromium }] = await Promise.all([
      import('playwright-core'), import('@sparticuz/chromium'),
    ]);
    browser = await playwright.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
    const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1280, height: 1600 } });
    await page.goto(mobileBlogUrl(url), { waitUntil: 'networkidle', timeout: 30000 });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '14mm', right: '10mm', bottom: '14mm', left: '10mm' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfName(url)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(pdf);
  } catch (error) {
    return fail(res, 502, `PDF 생성에 실패했습니다. ${error.message || ''}`.trim());
  } finally { await browser?.close().catch(() => {}); }
}
