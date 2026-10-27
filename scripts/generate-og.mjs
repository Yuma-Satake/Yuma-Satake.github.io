import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE_PATH = path.join(ROOT_DIR, "scripts/og/template.html");
const FONT_PATH = path.join(ROOT_DIR, "scripts/og/fonts/NotoSansJP.ttf");
const AVATAR_PATH = path.join(ROOT_DIR, "profile.jpg");
const BLOG_DIR = path.join(ROOT_DIR, "blog");

const INDEX_FLAG = "--index";

const VIEWPORT = { width: 1200, height: 630 };

const SLUG_PATTERN = /^[a-z0-9-]+$/;

const HTML_ENTITIES = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

/**
 * HTMLの文字参照を元の文字に戻す
 * @param {string} text
 * @returns {string}
 */
const decodeEntities = (text) =>
  text.replace(/&(?:amp|quot|#39|lt|gt);/g, (entity) => HTML_ENTITIES[entity]);

/**
 * テキストをHTML本文に埋め込めるようエスケープする
 * @param {string} text
 * @returns {string}
 */
const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * 記事HTMLのog:titleからタイトルを取り出す
 * @param {string} articleHtml
 * @returns {string | undefined}
 */
const extractTitle = (articleHtml) => {
  const matched = articleHtml.match(/<meta property="og:title" content="([^"]*)"/);
  return matched ? decodeEntities(matched[1]) : undefined;
};

/**
 * OGP画像を描画するためのHTMLを組み立てる
 * @param {string} template
 * @param {string[]} titleLines
 * @returns {string}
 */
const buildHtml = (template, titleLines) =>
  template
    .replace("{{FONT_URL}}", () => pathToFileURL(FONT_PATH).href)
    .replace("{{AVATAR_URL}}", () => pathToFileURL(AVATAR_PATH).href)
    .replace("{{TITLE}}", () => titleLines.map(escapeHtml).join("<br>"));

/**
 * 描画用HTMLをブラウザで開き、PNGとして保存する
 * @param {string} htmlPath
 * @param {string} outputPath
 * @returns {Promise<void>}
 */
const screenshotPage = async (htmlPath, outputPath) => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.goto(pathToFileURL(htmlPath).href);
    await page.waitForSelector("body[data-ready], body[data-error]");
    const errorMessage = await page.$eval("body", (body) => body.dataset.error);
    if (errorMessage) throw new Error(errorMessage);
    await page.screenshot({ path: outputPath, type: "png" });
  } finally {
    await browser.close();
  }
};

/**
 * HTMLを一時ファイルに書き出して描画し、PNGとして保存する
 * @param {string} html
 * @param {string} outputPath
 * @returns {Promise<void>}
 */
const renderPng = async (html, outputPath) => {
  const workDir = await mkdtemp(path.join(tmpdir(), "og-"));
  try {
    const htmlPath = path.join(workDir, "index.html");
    await writeFile(htmlPath, html);
    await screenshotPage(htmlPath, outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
};

/**
 * 記事のslugまたは一覧ページ(--index)からOGP画像を生成し、対象のディレクトリに保存する
 * 対象の後ろに行を渡すと、タイトルをその位置で改行して描画する
 * @returns {Promise<void>}
 */
const main = async () => {
  const [target, ...lines] = process.argv.slice(2);
  const isIndex = target === INDEX_FLAG;
  if (!isIndex && (!target || !SLUG_PATTERN.test(target)))
    throw new Error(`Usage: pnpm og <slug | ${INDEX_FLAG}> [line...]`);

  const pageDir = isIndex ? BLOG_DIR : path.join(BLOG_DIR, target);
  const relativeDir = path.relative(ROOT_DIR, pageDir);
  const pageHtml = await readFile(path.join(pageDir, "index.html"), "utf-8");
  const title = extractTitle(pageHtml);
  if (!title) throw new Error(`og:title not found in ${relativeDir}/index.html`);

  const titleLines = lines.length > 0 ? lines : [title];
  if (titleLines.join("") !== title) throw new Error("Lines must join to the og:title");

  const template = await readFile(TEMPLATE_PATH, "utf-8");
  await renderPng(buildHtml(template, titleLines), path.join(pageDir, "ogp.png"));
  console.log(`generated: ${relativeDir}/ogp.png`);
};

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
}
