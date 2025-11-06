# AGENTS

## プロジェクト概要
- **アプリ名**: 投信売却日チェッカー (`schedule-setter`)
- **目的**: 指定した年月の平日（日本の祝日除く）を抽出し、証券会社ごとの売却基準日を自動算出する。
- **実装方式**: 完全クライアントサイド。`index.html` + `styles.css` + `app.js` の静的3ファイル構成。

## ユーザーフロー
1. `index.html` の `<form id="month-form">` で年月 (`input[type="month"]`) を受け取る。初期値は「現在日時の翌月」。
2. 送信で `handleFormSubmit` が実行され、`collectBusinessDays` により当月の平日配列を構築。
3. 平日が各条件を満たすことを検証し、以下6種のマイルストン日を決定。
   - その月の2番目・3番目の平日
   - 3日 / 8日 / 12日 / 26日以降で2番目にあたる平日
4. `renderResult` が日付を `YYYY/M/D` で表示し、「カレンダーに追加」ボタンを描画。
5. ボタン押下で `AppleScript` URL スキームを介し macOS カレンダーに各予定を 9:00-12:00 で登録。

## ロジック仕様 (`app.js`)
- `HOLIDAY_MODULE_URL`: `https://esm.sh/@holiday-jp/holiday_jp@latest` を ESM 動的 `import`。祝日モジュール読み込み後にフォーム初期化。
- `collectBusinessDays(year, month)`:
  - 該当年月の 1 日~31 日を走査。
  - `getJapaneseHolidaySet` で取得した祝日 `Set` と曜日判定 (`1-5 = 月~金`) を使い平日配列を構築。
- `getJapaneseHolidaySet(year)`:
  - `holiday_jp.between` でその年の祝日配列を取得し、`YYYY-MM-DD` 文字列に正規化。
  - 年単位の `Map` キャッシュを導入し、同年の再計算を回避。
- 計算結果は `lastComputedDates` に保持され、AppleScript 生成時にも再利用。

## 表示ルール
- 規定の平日数に満たない場合は `renderMessage` が日本語メッセージを表示し、結果を消去。
- 成功時の表示フォーマット例: `楽天売却①、マネックス売却：2025/2/3`。
- 失敗ログは `console.error` にも出力されるため、ブラウザの DevTools で確認できる。

## AppleScript 連携
- `handleCalendarButtonClick` は `applescript://` スキームを利用し Script Editor を起動してコードを貼り付け。
- 予定はカレンダー1（通常はデフォルトカレンダー）に作成され、各イベントには 60 分前と 30 分前の表示アラームを付与。
- macOS 以外の環境ではこのボタンは無効（URL でエラーになるため無視される）。

## 外部依存と注意点
- **ネットワーク必須**: holiday-jp モジュールを CDN から読み込むため、オフラインでは初期化に失敗して案内メッセージが出る。
- **タイムゾーン**: `Date` は実行環境ローカルタイムを使用。日本国外で実行すると平日の判定が現地タイム基準になる点に留意。
- **祝日データの正確性**: `holiday_jp` に依存。将来分の祝日変更が反映されない場合は upstream アップデート待ち。
- **アクセシビリティ**: 結果表示セクションには `aria-live="polite"` を付与しているが、ボタンラベルは日本語のみ。

## 開発のヒント
- 祝日源泉を別 API に切り替える場合、`getJapaneseHolidaySet` の実装を差し替えるだけで済む。
- テストはブラウザで `app.js` を読み込み、DevTools コンソールから `collectBusinessDays(2025, 2)` などを呼び出すと挙動を確認できる。
- オフライン向けに `holiday_jp` をバンドルしたい場合は npm + ビルドステップを導入し、`import` パスを書き換える。
- AppleScript を使わない環境向けには `navigator.share` や `.ics` ダウンロードを代替案として実装できる。
