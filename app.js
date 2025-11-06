const form = document.getElementById("month-form");
const monthInput = document.getElementById("month-input");
const resultSection = document.getElementById("result");

// Ensure the month input defaults to the current month if possible.
const now = new Date();
const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
const defaultValue = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
monthInput.value = defaultValue;

let lastComputedDates = null;

form.addEventListener("submit", (event) => {
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
});

// Draw the first result immediately with the default month.
form.dispatchEvent(new Event("submit"));

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

  const holidays = new Set();
  const add = (date) => holidays.add(toISODateString(date));
  const addFixed = (month, day, condition = true) => {
    if (condition) {
      add(new Date(year, month - 1, day));
    }
  };

  const nthWeekdayOfMonth = (month, occurrence, weekday) => {
    const firstOfMonth = new Date(year, month - 1, 1);
    const firstWeekday = firstOfMonth.getDay();
    const offset = (7 + weekday - firstWeekday) % 7;
    const day = 1 + offset + 7 * (occurrence - 1);
    return new Date(year, month - 1, day);
  };

  const specialShifts = {
    2020: {
      marine: [7, 23],
      sports: [7, 24],
      mountain: [8, 10],
    },
    2021: {
      marine: [7, 22],
      sports: [7, 23],
      mountain: [8, 8],
    },
  };

  // Fixed-date holidays
  addFixed(1, 1); // 元日
  addFixed(2, 11); // 建国記念の日
  if (year >= 2020) {
    addFixed(2, 23); // 天皇誕生日（令和）
  } else if (year >= 1989 && year <= 2018) {
    addFixed(12, 23); // 平成時代の天皇誕生日
  }
  addFixed(4, 29); // 昭和の日
  addFixed(5, 3); // 憲法記念日
  addFixed(5, 4); // みどりの日
  addFixed(5, 5); // こどもの日
  addFixed(11, 3); // 文化の日
  addFixed(11, 23); // 勤労感謝の日

  // 成人の日
  if (year >= 2000) {
    add(nthWeekdayOfMonth(1, 2, 1));
  } else if (year >= 1949) {
    addFixed(1, 15);
  }

  // 春分の日・秋分の日（近似式、1980-2099で有効）
  add(calculateVernalEquinox(year));
  add(calculateAutumnalEquinox(year));

  // 海の日
  if (specialShifts[year]?.marine) {
    const [month, day] = specialShifts[year].marine;
    add(new Date(year, month - 1, day));
  } else if (year >= 2003) {
    add(nthWeekdayOfMonth(7, 3, 1));
  } else if (year >= 1996) {
    addFixed(7, 20);
  }

  // 山の日 特例
  if (specialShifts[year]?.mountain) {
    const [month, day] = specialShifts[year].mountain;
    add(new Date(year, month - 1, day));
  } else if (year >= 2016) {
    addFixed(8, 11);
  }

  // 敬老の日
  if (year >= 2003) {
    add(nthWeekdayOfMonth(9, 3, 1));
  } else if (year >= 1966) {
    addFixed(9, 15);
  }

  // スポーツの日（旧 体育の日）
  if (specialShifts[year]?.sports) {
    const [month, day] = specialShifts[year].sports;
    add(new Date(year, month - 1, day));
  } else if (year >= 2000) {
    add(nthWeekdayOfMonth(10, 2, 1));
  } else if (year >= 1966) {
    addFixed(10, 10);
  }

  // 振替休日
  const sortedHolidays = Array.from(holidays)
    .map((iso) => parseISODateString(iso))
    .sort((a, b) => a - b);
  const substitutes = [];
  for (const date of sortedHolidays) {
    if (date.getDay() === 0) {
      const candidate = new Date(date);
      do {
        candidate.setDate(candidate.getDate() + 1);
      } while (holidays.has(toISODateString(candidate)));
      substitutes.push(new Date(candidate));
    }
  }
  substitutes.forEach(add);

  // 国民の休日
  const extraHolidays = [];
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      const date = new Date(year, month - 1, day);
      if (date.getMonth() !== month - 1) {
        break;
      }
      const iso = toISODateString(date);
      if (holidays.has(iso)) {
        continue;
      }
      const prev = new Date(date);
      prev.setDate(prev.getDate() - 1);
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      if (holidays.has(toISODateString(prev)) && holidays.has(toISODateString(next))) {
        extraHolidays.push(new Date(date));
      }
    }
  }
  extraHolidays.forEach(add);

  holidayCache.set(year, holidays);
  return holidays;
}

function calculateVernalEquinox(year) {
  const day = Math.floor(20.8431 + 0.242194 * (year - 1980)) - Math.floor((year - 1980) / 4);
  return new Date(year, 2, day);
}

function calculateAutumnalEquinox(year) {
  const day = Math.floor(23.2488 + 0.242194 * (year - 1980)) - Math.floor((year - 1980) / 4);
  return new Date(year, 8, day);
}

function toISODateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODateString(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
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
      "    set time of theDate to (8 * hours)",
      "    copy theDate to theEndDate",
      "    set time of theEndDate to (12 * hours)",
      `    make new event with properties {summary:"${summary}", start date:theDate, end date:theEndDate}`,
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
