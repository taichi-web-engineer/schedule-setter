const form = document.getElementById("month-form");
const monthInput = document.getElementById("month-input");
const resultSection = document.getElementById("result");

const HOLIDAY_MODULE_URL = "https://esm.sh/@holiday-jp/holiday_jp@latest";

// Ensure the month input defaults to the current month if possible.
const now = new Date();
const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
const defaultValue = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
monthInput.value = defaultValue;

let lastComputedDates = null;
let holidayJpModule = null;

const holidayModulePromise = import(HOLIDAY_MODULE_URL).then((mod) => {
  holidayJpModule = mod.default ?? mod;
  return holidayJpModule;
});

function handleFormSubmit(event) {
  event.preventDefault();
  if (!monthInput.value) {
    renderMessage("年月を選択してください。");
    return;
  }

  const [yearStr, monthStr] = monthInput.value.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);

  if (Number.isNaN(year) || Number.isNaN(month)) {
    renderMessage("年月の形式が正しくありません。");
    return;
  }

  const businessDays = collectBusinessDays(year, month);
  if (businessDays.length < 3) {
    renderMessage("この月には平日（祝日除く）が3日未満です。");
    return;
  }

  const target = businessDays[2];
  renderResult(year, month, target, businessDays);
}

holidayModulePromise
  .then(() => {
    form.addEventListener("submit", handleFormSubmit);
    form.dispatchEvent(new Event("submit"));
  })
  .catch((error) => {
    console.error("holiday_jp の読み込みに失敗しました", error);
    renderMessage("祝日データの読み込みに失敗しました。ネットワーク接続を確認して再読み込みしてください。");
  });

/**
 * Collects business days (Mon-Fri excluding Japanese public holidays) within a given month.
 * @param {number} year - 4 digit year.
 * @param {number} month - 1 based month.
 * @returns {Date[]}
 */
function collectBusinessDays(year, month) {
  const holidays = getJapaneseHolidaySet(year);
  const businessDays = [];
  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(year, month - 1, day);
    if (date.getMonth() !== month - 1) {
      break;
    }
    const dayOfWeek = date.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const iso = toISODateString(date);
    const isHoliday = holidays.has(iso);
    if (isWeekday && !isHoliday) {
      businessDays.push(date);
    }
  }
  return businessDays;
}

function formatPlainDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

function renderMessage(message) {
  resultSection.innerHTML = "";
  lastComputedDates = null;
  const p = document.createElement("p");
  p.className = "supporting-text";
  p.textContent = message;
  resultSection.appendChild(p);
}

function renderResult(year, month, targetDate, businessDays) {
  resultSection.innerHTML = "";
  lastComputedDates = {
    second: new Date(businessDays[1].getTime()),
    third: new Date(targetDate.getTime()),
  };

  const secondValue = document.createElement("p");
  secondValue.className = "result-value";
  secondValue.textContent = `楽天売却①、マネックス売却：${formatPlainDate(lastComputedDates.second)}`;

  const thirdValue = document.createElement("p");
  thirdValue.className = "result-value";
  thirdValue.textContent = `三菱UFJe売却：${formatPlainDate(lastComputedDates.third)}`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "calendar-button";
  button.textContent = "カレンダーに追加";
  button.addEventListener("click", handleCalendarButtonClick);

  resultSection.append(secondValue, thirdValue, button);
}

const holidayCache = new Map();

/**
 * Returns a Set of ISO date strings (YYYY-MM-DD) representing Japanese public holidays for the given year.
 * Includes substitute holidays (振替休日) and citizen's holidays (国民の休日).
 * @param {number} year
 * @returns {Set<string>}
 */
function getJapaneseHolidaySet(year) {
  if (holidayCache.has(year)) {
    return holidayCache.get(year);
  }

  if (!holidayJpModule) {
    throw new Error("holiday_jp が初期化されていません。");
  }

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);
  const isoHolidays = holidayJpModule.between(startOfYear, endOfYear).map(({ date }) => {
    const normalized = date instanceof Date ? date : new Date(date);
    return toISODateString(normalized);
  });
  const holidays = new Set(isoHolidays);
  holidayCache.set(year, holidays);
  return holidays;
}

function toISODateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function handleCalendarButtonClick() {
  if (!lastComputedDates) {
    return;
  }
  const script = buildCalendarAppleScript(lastComputedDates);
  const url = `applescript://com.apple.scripteditor?action=new&script=${encodeURIComponent(script)}`;
  window.location.href = url;
}

function buildCalendarAppleScript(dates) {
  const { second, third } = dates;
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

const createEventBlock = (summary, date) => {
  const monthName = monthNames[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return [
    "    set theDate to current date",
    `    set year of theDate to ${year}`,
    `    set month of theDate to ${monthName}`,
    `    set day of theDate to ${day}`,
    "    set time of theDate to (9 * hours)",
    "    copy theDate to theEndDate",
    "    set time of theEndDate to (12 * hours)",
    `    set theEvent to make new event with properties {summary:"${summary}", start date:theDate, end date:theEndDate}`,
    "    tell theEvent",
    "      make new display alarm at end with properties {trigger interval:-60}",
    "      make new display alarm at end with properties {trigger interval:-30}",
    "    end tell",
  ].join("\n");
};

  const blocks = [];
  if (second) {
    blocks.push(createEventBlock("楽天売却①、マネックス売却", second));
  }
  if (third) {
    blocks.push(createEventBlock("三菱UFJe売却", third));
  }

  const scriptBody = blocks.join("\n\n");

  return `
tell application "Calendar"
  activate
  tell calendar 1
${scriptBody}
  end tell
end tell
`.trim();
}
