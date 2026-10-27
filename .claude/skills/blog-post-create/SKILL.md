---
name: blog-post-create
description: ブログ記事を新規追加する。ユーザーが「ブログ記事を追加して」「記事を書いて」「ブログを投稿したい」「新しい記事を作って」と依頼した場合に使用する。雛形から記事ページを作成し、OGP画像を生成して、記事一覧に追記する。
---

# blog-post-create

ビルド工程のない手書きHTMLのブログに、記事を1本追加する。

## 手順

### 1. 記事の情報を決める

AskUserQuestionで次を確認する。ユーザが既に伝えている項目は聞かない。

- タイトル
- slug（URLの一部になる英小文字・数字・ハイフンの識別子）。タイトルから候補を2つ以上提示する
- 投稿日（`YYYY-MM-DD`）。既定は今日の日付
- 説明文（OGPと検索結果に使う1文）。本文から候補を作って提示する
- 本文

既存の記事とslugが重複しないことを `blog/` 配下のディレクトリ名で確認する。

### 2. 記事ページを作る

- `post-template.html` を `blog/<slug>/index.html` にコピーする
- `{{TITLE}}` `{{DESCRIPTION}}` `{{SLUG}}` `{{DATE}}` `{{BODY}}` をすべて置換する
- 本文は `<p>` `<h3>` `<ul>` `<figure>` などのHTMLで書く。見出しは `<h3>` 以降を使う（`<h2>` はタイトル）
- タイトルと説明文に含まれる文字は、HTMLの属性・本文ではHTMLエンティティ（`&amp;` `&quot;` `&lt;`）に、JSON-LDではJSON文字列のエスケープ（`\"` `\\`）にする

### 3. 画像を置く

- 画像は記事と同じ `blog/<slug>/` に置き、本文では `<img src="<ファイル名>" alt="<代替テキスト>">` で参照する

### 4. OGP画像を生成する

- 依存が未インストールの場合は `pnpm install` を実行する
- `pnpm og <slug>` を実行し、記事の `og:title` から `blog/<slug>/ogp.png` を生成する
- 生成した画像を開き、タイトルが欠けたり崩れたりしていないことを確認する
- 改行位置が不自然な場合は、文節の区切りで改行する位置を自分で決め、`pnpm og <slug> "<1行目>" "<2行目>" ...` で再生成する。各行を連結した文字列は `og:title` と完全に一致させる
  - 文節や単語の途中で切れていないこと
  - 助詞や句読点が行頭に来ていないこと
  - 1行だけ極端に短くなっていないこと
- タイトルを変更した場合は `pnpm og <slug>` を再実行する

### 5. 記事一覧に追記する

`blog/index.html` の `<ul class="post-list">` に、投稿日の新しい順が保たれる位置へ次の1行を追加する。

```html
<li><time datetime="<YYYY-MM-DD>"><YYYY-MM-DD></time><a href="/blog/<slug>/"><タイトル></a></li>
```

### 6. 表示を確認する

- `pnpm dlx serve` で配信し、`/blog/` と `/blog/<slug>/` を開いて表示とリンクを確認する
- GAタグが存在し、`canonical`、`og:*`、JSON-LDの `headline` と `url` が記事固有の値になっていることを確認する

## 注意

- 記事一覧ページのOGP画像は `pnpm og --index` で生成する（`blog/index.html` の `og:title` を描画する）
- ナビや共通の `<head>` を変更する場合は、`blog/index.html`、全記事、`post-template.html` に手作業で反映する

コミットとpushはユーザの指示があるまで行わない。
