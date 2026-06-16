import { useEffect, useState } from "react";
import {
  BadgeAlert,
  Backpack,
  CalendarDays,
  CarFront,
  Circle,
  CircleCheckBig,
  ChevronRight,
  CookingPot,
  House,
  Info,
  PencilLine,
  Plus,
  Receipt,
  ShoppingCart,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { getStorageDriverSummary } from "./lib/sharedStore";
import { usePersistentState } from "./lib/usePersistentState";
import "./App.css";

const USERS = [
  "Isi",
  "Florian",
  "Luisa",
  "Christian",
  "Janin",
  "Flo",
  "Max",
  "Jenni",
  "Carla",
  "Christoph",
];

const VACATION_START = new Date("2026-07-04T00:00:00");
const VACATION_END = new Date("2026-07-18T00:00:00");
const APP_ROUTES = [
  "/",
  "/arrival-times",
  "/daily-plans",
  "/travel-info",
  "/shopping-list",
  "/packing-list",
  "/cooking-plan",
  "/finanzen",
  "/allergies",
];
const PACKING_CATEGORIES = ["Essen", "Spiele & Spaß", "Sonstiges"];
const LEGACY_PACKING_CATEGORY_MAP = {
  Food: "Essen",
  "Games & Fun": "Spiele & Spaß",
  Miscellaneous: "Sonstiges",
};
const STORAGE_KEYS = {
  username: "username",
  etaPlans: "vacation_eta_plans",
  arrivalGroups: "vacation_arrival_groups",
  dayPlans: "vacation_day_plans",
  importantInfos: "vacation_important_infos",
  travelInfo: "vacation_travel_info",
  shoppingItems: "vacation_shopping_items",
  packingItems: "vacation_packing_items",
  cookingPlans: "vacation_cooking_plans",
  financeExpenses: "vacation_finance_expenses",
  allergies: "vacation_allergies",
};

const EMPTY_TRAVEL_INFO = {
  maut: "",
  route: "",
  treffpunkt: "",
  unterkunft: "",
  hinweise: "",
};

function createId() {
  return crypto.randomUUID();
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildVacationDays() {
  const dates = [];
  const cursor = new Date(VACATION_START);

  while (cursor <= VACATION_END) {
    dates.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

const VACATION_DAYS = buildVacationDays();
const VACATION_START_KEY = formatDateKey(VACATION_START);
const VACATION_END_KEY = formatDateKey(VACATION_END);

function normalizeRoute(pathname) {
  const cleanPath = pathname === "" ? "/" : pathname.replace(/\/+$/, "") || "/";
  return APP_ROUTES.includes(cleanPath) ? cleanPath : "/";
}

function readJsonStorage(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function getAlternateUser(person) {
  return USERS.find((entry) => entry !== person) ?? USERS[0];
}

function formatCountdown(now) {
  const differenceInMs = VACATION_START.getTime() - now.getTime();
  return Math.max(0, Math.ceil(differenceInMs / (1000 * 60 * 60 * 24)));
}

function formatDateLabel(dateKey) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${dateKey}T00:00:00`));
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getValidVacationDateKey(dateKey) {
  return VACATION_DAYS.includes(dateKey) ? dateKey : VACATION_START_KEY;
}

function getPreviewDateFromSearch(search) {
  const params = new URLSearchParams(search);
  const previewDateValue = params.get("previewDate");

  if (!previewDateValue || !/^\d{4}-\d{2}-\d{2}$/.test(previewDateValue)) {
    return null;
  }

  const previewDate = new Date(`${previewDateValue}T12:00:00`);
  return Number.isNaN(previewDate.getTime()) ? null : previewDate;
}

function formatVacationDayLabel(dateKey) {
  const baseLabel = formatDateLabel(dateKey);

  if (dateKey === VACATION_START_KEY) {
    return `${baseLabel} · Anreise`;
  }

  if (dateKey === VACATION_END_KEY) {
    return `${baseLabel} · Abreise`;
  }

  return baseLabel;
}

function formatArrivalTime(value) {
  if (!value) {
    return "Noch keine Zeit eingetragen";
  }

  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function sortByArrivalTime(entries) {
  return [...entries].sort((first, second) => {
    if (!first.eta && !second.eta) {
      return 0;
    }

    if (!first.eta) {
      return 1;
    }

    if (!second.eta) {
      return -1;
    }

    return new Date(first.eta).getTime() - new Date(second.eta).getTime();
  });
}

function normalizePackingItems(savedItems = []) {
  return savedItems.map((item) => ({
    ...item,
    category:
      LEGACY_PACKING_CATEGORY_MAP[item.category] ??
      item.category ??
      PACKING_CATEGORIES[0],
  }));
}

function normalizeShoppingItems(savedItems = []) {
  return savedItems.map((item) => ({
    id: item.id ?? createId(),
    item: item.item ?? "",
    addedBy: USERS.includes(item.addedBy ?? item.person) ? item.addedBy ?? item.person : USERS[0],
    checked: Boolean(item.checked),
    checkedBy: USERS.includes(item.checkedBy) ? item.checkedBy : "",
  }));
}

function normalizeCookingPeople(firstPerson, secondPerson) {
  const personOne = USERS.includes(firstPerson) ? firstPerson : USERS[0];
  const fallbackPersonTwo = getAlternateUser(personOne);
  const personTwo =
    USERS.includes(secondPerson) && secondPerson !== personOne
      ? secondPerson
      : fallbackPersonTwo;

  return {
    personOne,
    personTwo,
  };
}

function normalizeCookingPlans(savedPlans = []) {
  return savedPlans.map((entry) => {
    const { personOne, personTwo } = normalizeCookingPeople(
      entry.personOne ?? entry.person,
      entry.personTwo
    );

    return {
      ...entry,
      gericht: entry.gericht ?? entry.meal ?? "",
      personOne,
      personTwo,
    };
  });
}

function normalizeTravelInfo(savedInfo = {}) {
  return {
    maut: savedInfo.maut ?? "",
    route: savedInfo.route ?? "",
    treffpunkt: savedInfo.treffpunkt ?? "",
    unterkunft: savedInfo.unterkunft ?? "",
    hinweise: savedInfo.hinweise ?? "",
  };
}

function normalizeImportantInfos(savedInfos = []) {
  return savedInfos
    .map((entry) => ({
      id: entry.id ?? createId(),
      date: getValidVacationDateKey(entry.date),
      person: USERS.includes(entry.person) ? entry.person : USERS[0],
      message: entry.message ?? "",
    }))
    .filter((entry) => entry.message.trim());
}

function normalizeFinanceExpenses(savedExpenses = []) {
  return savedExpenses
    .map((entry) => {
      const paidBy = USERS.includes(entry.paidBy ?? entry.createdBy ?? entry.person)
        ? entry.paidBy ?? entry.createdBy ?? entry.person
        : USERS[0];
      const relevantUsers = Array.isArray(entry.relevantUsers ?? entry.affectedUsers)
        ? (entry.relevantUsers ?? entry.affectedUsers).filter(
            (person) => USERS.includes(person) && person !== paidBy
          )
        : [];
      const settledBySource = entry.settledBy && typeof entry.settledBy === "object" ? entry.settledBy : {};
      const settledBy = Object.fromEntries(
        relevantUsers.map((person) => [person, Boolean(settledBySource[person])])
      );

      return {
        id: entry.id ?? createId(),
        title: entry.title ?? entry.label ?? "",
        note: entry.note ?? "",
        paidBy,
        relevantUsers,
        includePayerShare: Boolean(entry.includePayerShare),
        amountCents:
          typeof entry.amountCents === "number"
            ? Math.round(entry.amountCents)
            : Math.round(Number(entry.amount ?? 0) * 100),
        createdAt: entry.createdAt ?? new Date().toISOString(),
        settledBy,
      };
    })
    .filter((entry) => entry.title.trim() && entry.amountCents > 0 && entry.relevantUsers.length > 0);
}

function normalizeDayPlans(savedPlans = []) {
  return savedPlans.map((entry) => ({
    id: entry.id ?? createId(),
    date: VACATION_DAYS.includes(entry.date ?? entry.day)
      ? entry.date ?? entry.day
      : VACATION_START_KEY,
    title: entry.title ?? entry.activity ?? "",
    note: entry.note ?? "",
    createdBy: USERS.includes(entry.createdBy) ? entry.createdBy : entry.person ?? "",
    allDay: entry.allDay ?? !(entry.startTime || entry.endTime),
    startTime: entry.startTime ?? "",
    endTime: entry.endTime ?? "",
  }));
}

function migrateLegacyArrivalGroups(savedEtaPlans = []) {
  return savedEtaPlans
    .filter((entry) => entry.eta || entry.note)
    .map((entry) => ({
      id: createId(),
      label: entry.person ?? "",
      travelers: entry.person ? [entry.person] : [],
      eta: entry.eta ?? "",
      note: entry.note ?? "",
    }));
}

function normalizeArrivalGroups(savedGroups = []) {
  return savedGroups
    .map((entry) => ({
      id: entry.id ?? createId(),
      label: entry.label ?? "",
      travelers: Array.isArray(entry.travelers)
        ? entry.travelers.filter((person) => USERS.includes(person))
        : entry.person
          ? [entry.person]
          : [],
      eta: entry.eta ?? "",
      note: entry.note ?? "",
    }))
    .filter((entry) => entry.travelers.length > 0 || entry.label || entry.eta || entry.note);
}

function getInitialArrivalGroups() {
  return migrateLegacyArrivalGroups(readJsonStorage(STORAGE_KEYS.etaPlans, []));
}

function getArrivalFormDefaults(person) {
  return {
    label: "",
    travelers: [person],
    eta: "",
    note: "",
  };
}

function getDayPlanFormDefaults(person) {
  return {
    date: VACATION_START_KEY,
    title: "",
    note: "",
    createdBy: person,
    allDay: true,
    startTime: "",
    endTime: "",
  };
}

function getPackingFormDefaults(person) {
  return {
    item: "",
    person,
    category: PACKING_CATEGORIES[0],
  };
}

function getShoppingFormDefaults(person) {
  return {
    item: "",
    addedBy: person,
  };
}

function getCookingFormDefaults(person) {
  const { personOne, personTwo } = normalizeCookingPeople(person, "");

  return {
    day: VACATION_START_KEY,
    gericht: "",
    personOne,
    personTwo,
  };
}

function getAllergyFormDefaults(person) {
  return {
    person,
    allergy: "",
  };
}

function getFinanceFormDefaults(person) {
  return {
    title: "",
    amount: "",
    note: "",
    paidBy: person,
    relevantUsers: [],
    includePayerShare: true,
  };
}

function getTravelInfoSections(info) {
  return [
    { key: "maut", title: "Maut", text: info.maut },
    { key: "route", title: "Route", text: info.route },
    { key: "treffpunkt", title: "Treffpunkt", text: info.treffpunkt },
    { key: "unterkunft", title: "Unterkunft", text: info.unterkunft },
    { key: "hinweise", title: "Weitere Hinweise", text: info.hinweise },
  ];
}

function getImportantInfoFormDefaults(person, dateKey = VACATION_START_KEY) {
  return {
    date: getValidVacationDateKey(dateKey),
    person,
    message: "",
  };
}

function getImportantInfosForDate(importantInfos, dateKey) {
  return [...importantInfos]
    .filter((entry) => entry.date === getValidVacationDateKey(dateKey))
    .reverse();
}

function formatCurrency(cents) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format((cents ?? 0) / 100);
}

function formatDateTimeLabel(value) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTimeRange(startTime, endTime, allDay) {
  if (allDay) {
    return "Ganztägig";
  }

  if (startTime && endTime) {
    return `${startTime} - ${endTime} Uhr`;
  }

  if (startTime) {
    return `Ab ${startTime} Uhr`;
  }

  if (endTime) {
    return `Bis ${endTime} Uhr`;
  }

  return "Uhrzeit offen";
}

function compareDayPlanEntries(first, second) {
  if (first.allDay && !second.allDay) {
    return -1;
  }

  if (!first.allDay && second.allDay) {
    return 1;
  }

  if (!first.startTime && !second.startTime) {
    return 0;
  }

  if (!first.startTime) {
    return 1;
  }

  if (!second.startTime) {
    return -1;
  }

  return first.startTime.localeCompare(second.startTime);
}

function getExpenseParticipantCount(expense) {
  return expense.relevantUsers.length + (expense.includePayerShare ? 1 : 0);
}

function getExpenseShareMap(expense) {
  const participants = expense.includePayerShare
    ? [expense.paidBy, ...expense.relevantUsers]
    : [...expense.relevantUsers];
  const users = expense.relevantUsers;

  if (users.length === 0 || participants.length === 0) {
    return {};
  }

  const base = Math.floor(expense.amountCents / participants.length);
  let remainder = expense.amountCents % participants.length;
  const sharesByParticipant = {};

  participants.forEach((person) => {
    const share = base + (remainder > 0 ? 1 : 0);
    sharesByParticipant[person] = share;
    if (remainder > 0) {
      remainder -= 1;
    }
  });

  return Object.fromEntries(
    users.map((person) => {
      const share = sharesByParticipant[person] ?? 0;
      return [person, share];
    })
  );
}

function getOpenAmountForExpense(expense) {
  const shareMap = getExpenseShareMap(expense);

  return Object.entries(shareMap).reduce((sum, [person, cents]) => {
    if (expense.settledBy[person]) {
      return sum;
    }

    return sum + cents;
  }, 0);
}

function getBalanceSummary(selectedUser, expenses) {
  const balances = {};

  expenses.forEach((expense) => {
    const shareMap = getExpenseShareMap(expense);

    Object.entries(shareMap).forEach(([person, cents]) => {
      if (expense.settledBy[person]) {
        return;
      }

      if (expense.paidBy === selectedUser) {
        balances[person] = (balances[person] ?? 0) + cents;
      }

      if (person === selectedUser) {
        balances[expense.paidBy] = (balances[expense.paidBy] ?? 0) - cents;
      }
    });
  });

  return Object.entries(balances)
    .filter(([, cents]) => cents !== 0)
    .map(([person, cents]) => ({
      person,
      cents,
    }))
    .sort((first, second) => Math.abs(second.cents) - Math.abs(first.cents));
}

function getScheduleEntriesForDate(dateKey, dayPlans, cookingPlans) {
  const dailyEntries = dayPlans
    .filter((entry) => entry.date === dateKey)
    .sort(compareDayPlanEntries)
    .map((entry) => ({
      id: entry.id,
      type: "plan",
      title: entry.title,
      createdBy: entry.createdBy,
      meta: `${formatTimeRange(entry.startTime, entry.endTime, entry.allDay)} · Von ${entry.createdBy}`,
      note: entry.note,
      allDay: entry.allDay,
      startTime: entry.startTime,
      endTime: entry.endTime,
    }));

  const dinnerEntries = cookingPlans
    .filter((entry) => entry.day === dateKey)
    .map((entry) => ({
      id: `meal-${entry.id}`,
      type: "meal",
      title: `Abendessen: ${entry.gericht}`,
      meta: `${entry.personOne} und ${entry.personTwo}`,
      note: "Aus dem Essensplan",
    }));

  return [...dailyEntries, ...dinnerEntries];
}

function getCalendarPreviewEntries(dayPlans, cookingPlans) {
  const entries = VACATION_DAYS.flatMap((dateKey) =>
    getScheduleEntriesForDate(dateKey, dayPlans, cookingPlans).map((entry) => ({
      ...entry,
      date: dateKey,
    }))
  );

  return entries.slice(0, 3);
}

function getHomeScheduleEntries(currentDateKey, dayPlans, cookingPlans, isDuringVacation) {
  if (isDuringVacation && VACATION_DAYS.includes(currentDateKey)) {
    return getScheduleEntriesForDate(currentDateKey, dayPlans, cookingPlans).map((entry) => ({
      ...entry,
      date: currentDateKey,
    }));
  }

  return getCalendarPreviewEntries(dayPlans, cookingPlans);
}

function getHomeCards(
  dayPlans,
  shoppingItems,
  packingItems,
  cookingPlans,
  financeExpenses,
  allergies,
  showPackingCard
) {
  const cards = [
    {
      path: "/daily-plans",
      title: "Tagespläne",
      subtitle:
        dayPlans.length > 0
          ? `${dayPlans.length} Einträge im Urlaubskalender`
          : "Vorab Ideen und Tagespunkte sammeln",
      color: "blue",
      Icon: CalendarDays,
    },
    {
      path: "/shopping-list",
      title: "Einkaufsliste",
      subtitle:
        shoppingItems.length > 0
          ? `${shoppingItems.length} Dinge auf der Liste`
          : "Lebensmittel und Besorgungen sammeln",
      color: "soft",
      Icon: ShoppingCart,
    },
    {
      path: "/cooking-plan",
      title: "Essensplan",
      subtitle:
        cookingPlans.length > 0
          ? `${cookingPlans.length} Mahlzeiten geplant`
          : "Gerichte und Kochteams eintragen",
      color: "yellow",
      Icon: CookingPot,
    },
    {
      path: "/finanzen",
      title: "Finanzen",
      subtitle:
        financeExpenses.length > 0
          ? `${financeExpenses.length} Kosten eingetragen`
          : "Ausgaben, Rückzahlungen und Salden verwalten",
      color: "sand",
      Icon: Wallet,
    },
    {
      path: "/allergies",
      title: "Allergien",
      subtitle:
        allergies.length > 0
          ? `${allergies.length} Hinweise eingetragen`
          : "Allergien und Unverträglichkeiten hinterlegen",
      color: "coral",
      Icon: BadgeAlert,
    },
  ];

  if (showPackingCard) {
    cards.splice(2, 0, {
      path: "/packing-list",
      title: "Packliste",
      subtitle:
        packingItems.length > 0
          ? `${packingItems.length} Einträge für die Gruppe`
          : "Essen, Spiele und Sonstiges sammeln",
      color: "green",
      Icon: Backpack,
    });
  }

  return cards;
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function PageHeader({ Icon, title, description }) {
  return (
    <header className="page-header">
      <div className="page-header__icon">
        <Icon size={22} strokeWidth={1.8} />
      </div>

      <div>
        <p className="page-header__eyebrow">PLANUNG</p>
        <h2>{title}</h2>
        <p className="page-header__description">{description}</p>
      </div>
    </header>
  );
}

function PreviewLink({ text, onClick }) {
  return (
    <button className="text-link" type="button" onClick={onClick}>
      {text}
      <ChevronRight size={16} strokeWidth={1.9} />
    </button>
  );
}

function ArrivalOverviewWidget({ arrivalGroups, travelInfo, onOpen }) {
  const previewEntries = sortByArrivalTime(arrivalGroups).slice(0, 2);
  const filledSections = getTravelInfoSections(travelInfo).filter((section) => section.text.trim());

  return (
    <section className="widget-card widget-card--soft">
      <div className="widget-card__header">
        <div className="widget-card__title-wrap">
          <div className="widget-card__icon">
            <CarFront size={20} strokeWidth={1.9} />
          </div>
          <div>
            <p className="widget-card__eyebrow">ANREISE</p>
            <h3>Anreise</h3>
          </div>
        </div>

        <PreviewLink text="Öffnen" onClick={onOpen} />
      </div>

      <div className="compact-list">
        <div className="compact-list__item">
          <p className="compact-list__title">Ankunftszeiten</p>
          {previewEntries.length === 0 ? (
            <p className="compact-list__meta">Noch keine Ankunftszeit eingetragen.</p>
          ) : (
            previewEntries.map((entry) => (
              <p className="compact-list__meta" key={entry.id}>
                {(entry.label || entry.travelers.join(", "))}: {formatArrivalTime(entry.eta)}
              </p>
            ))
          )}
        </div>

        <div className="compact-list__item">
          <p className="compact-list__title">Infos für die Fahrt</p>
          {filledSections.length === 0 ? (
            <p className="compact-list__meta">Noch keine Reiseinfos hinterlegt.</p>
          ) : (
            filledSections.slice(0, 2).map((section) => (
              <p className="compact-list__meta compact-list__meta--truncate" key={section.key}>
                {section.title}: {section.text}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function ArrivalTimesPage({
  selectedUser,
  arrivalGroups,
  travelInfo,
  onSaveArrivalGroup,
  onDeleteArrivalGroup,
  onSaveTravelInfo,
}) {
  const [arrivalForm, setArrivalForm] = useState(getArrivalFormDefaults(selectedUser));
  const [editingArrivalId, setEditingArrivalId] = useState("");
  const [isArrivalFormOpen, setIsArrivalFormOpen] = useState(false);
  const [travelInfoForm, setTravelInfoForm] = useState(travelInfo);
  const [isTravelInfoFormOpen, setIsTravelInfoFormOpen] = useState(false);

  const sortedGroups = sortByArrivalTime(arrivalGroups);

  function toggleTraveler(person) {
    setArrivalForm((current) => {
      const exists = current.travelers.includes(person);

      if (exists) {
        if (current.travelers.length === 1) {
          return current;
        }

        return {
          ...current,
          travelers: current.travelers.filter((entry) => entry !== person),
        };
      }

      return {
        ...current,
        travelers: [...current.travelers, person],
      };
    });
  }

  function handleArrivalSubmit(event) {
    event.preventDefault();

    if (arrivalForm.travelers.length === 0 || !arrivalForm.eta) {
      return;
    }

    onSaveArrivalGroup({
      id: editingArrivalId || createId(),
      label: arrivalForm.label.trim(),
      travelers: arrivalForm.travelers,
      eta: arrivalForm.eta,
      note: arrivalForm.note.trim(),
    });

    setEditingArrivalId("");
    setArrivalForm(getArrivalFormDefaults(selectedUser));
    setIsArrivalFormOpen(false);
  }

  function handleTravelInfoSubmit(event) {
    event.preventDefault();
    onSaveTravelInfo(travelInfoForm);
    setIsTravelInfoFormOpen(false);
  }

  return (
    <section className="page-stack">
      <PageHeader
        Icon={CarFront}
        title="Anreise"
        description="Bis zur Anreise stehen hier Ankunftszeiten und alle wichtigen Fahrtinfos gesammelt an einer Stelle."
      />

      <section className="list-section">
        <div className="section-heading">
          <h3>Ankunftszeiten</h3>
          <button
            className="inline-action"
            type="button"
            onClick={() => {
              setEditingArrivalId("");
              setArrivalForm(getArrivalFormDefaults(selectedUser));
              setIsArrivalFormOpen((current) => !current);
            }}
          >
            {isArrivalFormOpen ? "Maske schließen" : "Ankunftszeit hinzufügen"}
          </button>
        </div>

        {isArrivalFormOpen ? (
          <form className="editor-card editor-card--soft-blue" onSubmit={handleArrivalSubmit}>
            <div className="editor-card__title">
              <span>{editingArrivalId ? "Ankunft bearbeiten" : "Ankunft hinzufügen"}</span>
              <Plus size={18} strokeWidth={1.9} />
            </div>

            <label className="field">
              <span>Gruppenname</span>
              <input
                type="text"
                placeholder="Optional, z. B. Auto 1"
                value={arrivalForm.label}
                onChange={(event) =>
                  setArrivalForm((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
              />
            </label>

            <div className="field">
              <span>Reisende</span>
              <div className="traveler-grid">
                {USERS.map((person) => (
                  <button
                    className={`traveler-chip ${arrivalForm.travelers.includes(person) ? "traveler-chip--active" : ""}`}
                    key={person}
                    type="button"
                    onClick={() => toggleTraveler(person)}
                  >
                    {person}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Ankunftszeit</span>
                <input
                  type="datetime-local"
                  value={arrivalForm.eta}
                  onChange={(event) =>
                    setArrivalForm((current) => ({
                      ...current,
                      eta: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Anzahl</span>
                <input type="text" value={`${arrivalForm.travelers.length} Reisende`} disabled />
              </label>
            </div>

            <label className="field">
              <span>Notiz</span>
              <textarea
                rows="3"
                placeholder="Optional, z. B. Fahrt über München oder gemeinsamer Supermarkt-Stopp"
                value={arrivalForm.note}
                onChange={(event) =>
                  setArrivalForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </label>

            <div className="form-actions">
              <button className="primary-button" type="submit">
                {editingArrivalId ? "Aktualisieren" : "Speichern"}
              </button>

              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditingArrivalId("");
                  setArrivalForm(getArrivalFormDefaults(selectedUser));
                  setIsArrivalFormOpen(false);
                }}
              >
                Abbrechen
              </button>
            </div>
          </form>
        ) : null}

        {sortedGroups.length === 0 ? (
          <EmptyState text="Noch keine Ankunftszeiten eingetragen." />
        ) : (
          <div className="stack">
            {sortedGroups.map((entry) => (
              <article className="item-card item-card--soft-blue" key={entry.id}>
                <div>
                  <p className="item-card__title">{entry.label || entry.travelers.join(", ")}</p>
                  <p className="item-card__meta">{entry.travelers.join(", ")}</p>
                  <p className="item-card__meta">{formatArrivalTime(entry.eta)}</p>
                  {entry.note ? <p className="item-card__note">{entry.note}</p> : null}
                </div>

                <div className="item-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Ankunft bearbeiten"
                    onClick={() => {
                      setEditingArrivalId(entry.id);
                      setArrivalForm({
                        label: entry.label,
                        travelers: entry.travelers,
                        eta: entry.eta,
                        note: entry.note,
                      });
                      setIsArrivalFormOpen(true);
                    }}
                  >
                    <PencilLine size={16} strokeWidth={1.9} />
                  </button>

                  <button
                    className="icon-button icon-button--danger"
                    type="button"
                    aria-label="Ankunft löschen"
                    onClick={() => {
                      onDeleteArrivalGroup(entry.id);
                      if (editingArrivalId === entry.id) {
                        setEditingArrivalId("");
                        setArrivalForm(getArrivalFormDefaults(selectedUser));
                        setIsArrivalFormOpen(false);
                      }
                    }}
                  >
                    <Trash2 size={16} strokeWidth={1.9} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="list-section">
        <div className="section-heading">
          <h3>Infos für die Fahrt</h3>
          <button
            className="inline-action"
            type="button"
            onClick={() => setIsTravelInfoFormOpen((current) => !current)}
          >
            {isTravelInfoFormOpen ? "Maske schließen" : "Reiseinfo hinzufügen"}
          </button>
        </div>

        {isTravelInfoFormOpen ? (
          <form className="editor-card editor-card--warm" onSubmit={handleTravelInfoSubmit}>
            <div className="editor-card__title">
              <span>Reiseinfos bearbeiten</span>
              <Info size={18} strokeWidth={1.9} />
            </div>

            <label className="field">
              <span>Maut</span>
              <textarea
                rows="3"
                placeholder="z. B. Vignette, Gebühren oder Bezahlinfos"
                value={travelInfoForm.maut}
                onChange={(event) =>
                  setTravelInfoForm((current) => ({
                    ...current,
                    maut: event.target.value,
                  }))
                }
              />
            </label>

            <label className="field">
              <span>Route</span>
              <textarea
                rows="3"
                placeholder="z. B. beste Strecke, Zwischenstopps oder Treffpunkte"
                value={travelInfoForm.route}
                onChange={(event) =>
                  setTravelInfoForm((current) => ({
                    ...current,
                    route: event.target.value,
                  }))
                }
              />
            </label>

            <div className="field-grid">
              <label className="field">
                <span>Treffpunkt</span>
                <input
                  type="text"
                  placeholder="z. B. 05:30 Uhr bei Isi"
                  value={travelInfoForm.treffpunkt}
                  onChange={(event) =>
                    setTravelInfoForm((current) => ({
                      ...current,
                      treffpunkt: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Unterkunft</span>
                <input
                  type="text"
                  placeholder="z. B. Adresse oder Check-in"
                  value={travelInfoForm.unterkunft}
                  onChange={(event) =>
                    setTravelInfoForm((current) => ({
                      ...current,
                      unterkunft: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label className="field">
              <span>Weitere Hinweise</span>
              <textarea
                rows="4"
                placeholder="z. B. Tankstellen, Parken, Ausweise oder wichtige Links"
                value={travelInfoForm.hinweise}
                onChange={(event) =>
                  setTravelInfoForm((current) => ({
                    ...current,
                    hinweise: event.target.value,
                  }))
                }
              />
            </label>

            <div className="form-actions">
              <button className="primary-button" type="submit">
                Speichern
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setTravelInfoForm(travelInfo);
                  setIsTravelInfoFormOpen(false);
                }}
              >
                Abbrechen
              </button>
            </div>
          </form>
        ) : null}

        <div className="stack">
          {getTravelInfoSections(travelInfo).map((section) => (
            <article className="item-card item-card--warm" key={section.key}>
              <div>
                <p className="item-card__title">{section.title}</p>
                <p className="item-card__note">
                  {section.text.trim() || "Noch keine Information hinterlegt."}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function ImportantInfoFormCard({
  form,
  setForm,
  editingImportantInfoId,
  onSubmit,
  onCancel,
  title = "Wichtige Informationen",
  description = "Für Ausflüge, Abwesenheiten oder alles, was die Gruppe an dem Tag wissen sollte.",
}) {
  return (
    <section className="editor-card editor-card--info">
      <div className="editor-card__title">
        <span>{title}</span>
        <Info size={18} strokeWidth={1.9} />
      </div>

      <p className="section-copy">{description}</p>

      <form onSubmit={onSubmit}>
        <div className="field-grid">
          <label className="field">
            <span>Datum</span>
            <select
              value={form.date}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
            >
              {VACATION_DAYS.map((dateKey) => (
                <option key={dateKey} value={dateKey}>
                  {formatVacationDayLabel(dateKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Person</span>
            <select
              value={form.person}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  person: event.target.value,
                }))
              }
            >
              {USERS.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Nachricht</span>
          <textarea
            rows="3"
            placeholder="z. B. Fahrradtour von 10 - 13 Uhr oder ich fehle beim Abendessen"
            value={form.message}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                message: event.target.value,
              }))
            }
          />
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            {editingImportantInfoId ? "Aktualisieren" : "Hinterlassen"}
          </button>

          {editingImportantInfoId ? (
            <button className="secondary-button" type="button" onClick={onCancel}>
              Abbrechen
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function ImportantInfoList({
  entries,
  emptyText,
  onEdit,
  onDelete,
  compact = false,
}) {
  if (entries.length === 0) {
    return compact ? <p className="widget-card__text">{emptyText}</p> : <EmptyState text={emptyText} />;
  }

  if (compact) {
    return (
      <div className="compact-list">
        {entries.map((entry) => (
          <div className="compact-list__item" key={entry.id}>
            <div className="compact-list__row">
              <div>
                <p className="compact-list__title">{entry.person}</p>
                <p className="compact-list__meta">{entry.message}</p>
              </div>

              <div className="item-actions">
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Information bearbeiten"
                  onClick={() => onEdit(entry)}
                >
                  <PencilLine size={16} strokeWidth={1.9} />
                </button>

                <button
                  className="icon-button icon-button--danger"
                  type="button"
                  aria-label="Information löschen"
                  onClick={() => onDelete(entry.id)}
                >
                  <Trash2 size={16} strokeWidth={1.9} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="stack">
      {entries.map((entry) => (
        <article className="item-card item-card--info" key={entry.id}>
          <div>
            <p className="item-card__title">{entry.person}</p>
            <p className="item-card__note">{entry.message}</p>
          </div>

          <div className="item-actions">
            <button
              className="icon-button"
              type="button"
              aria-label="Information bearbeiten"
              onClick={() => onEdit(entry)}
            >
              <PencilLine size={16} strokeWidth={1.9} />
            </button>

            <button
              className="icon-button icon-button--danger"
              type="button"
              aria-label="Information löschen"
              onClick={() => onDelete(entry.id)}
            >
              <Trash2 size={16} strokeWidth={1.9} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ImportantInfoSection({
  currentDateKey,
  selectedUser,
  importantInfos,
  onSaveImportantInfo,
  onDeleteImportantInfo,
  onOpenAllDays,
}) {
  const [importantInfoForm, setImportantInfoForm] = useState(
    getImportantInfoFormDefaults(selectedUser, currentDateKey)
  );
  const [editingImportantInfoId, setEditingImportantInfoId] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const orderedInfos = getImportantInfosForDate(importantInfos, currentDateKey);

  function resetForm() {
    setEditingImportantInfoId("");
    setImportantInfoForm(getImportantInfoFormDefaults(selectedUser, currentDateKey));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!importantInfoForm.message.trim()) {
      return;
    }

    onSaveImportantInfo({
      id: editingImportantInfoId || createId(),
      date: importantInfoForm.date,
      person: importantInfoForm.person,
      message: importantInfoForm.message.trim(),
    });

    resetForm();
    setIsDialogOpen(false);
  }

  function handleEdit(entry) {
    setEditingImportantInfoId(entry.id);
    setImportantInfoForm({
      date: entry.date,
      person: entry.person,
      message: entry.message,
    });
    setIsDialogOpen(true);
  }

  function handleDelete(id) {
    onDeleteImportantInfo(id);

    if (editingImportantInfoId === id) {
      resetForm();
      setIsDialogOpen(false);
    }
  }

  return (
    <>
      <section className="widget-card widget-card--info">
        <div className="widget-card__header">
          <div className="widget-card__title-wrap">
            <div className="widget-card__icon">
              <Info size={20} strokeWidth={1.9} />
            </div>
            <div>
              <p className="widget-card__eyebrow">HEUTE</p>
              <h3>Wichtige Informationen</h3>
            </div>
          </div>

          <div className="widget-card__actions">
            <PreviewLink text="Alle Tage" onClick={onOpenAllDays} />
            <button
              className="icon-button"
              type="button"
              aria-label="Wichtige Information hinzufügen"
              onClick={() => {
                resetForm();
                setIsDialogOpen(true);
              }}
            >
              <Plus size={18} strokeWidth={1.9} />
            </button>
          </div>
        </div>

        <p className="widget-card__text widget-card__text--small">
          {formatVacationDayLabel(currentDateKey)}
        </p>

        <ImportantInfoList
          entries={orderedInfos}
          emptyText="Für heute gibt es noch keine wichtigen Informationen."
          onEdit={handleEdit}
          onDelete={handleDelete}
          compact
        />
      </section>

      {isDialogOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            resetForm();
            setIsDialogOpen(false);
          }}
        >
          <div className="modal-dialog" onClick={(event) => event.stopPropagation()}>
            <ImportantInfoFormCard
              form={importantInfoForm}
              setForm={setImportantInfoForm}
              editingImportantInfoId={editingImportantInfoId}
              onSubmit={handleSubmit}
              onCancel={() => {
                resetForm();
                setIsDialogOpen(false);
              }}
              title="Wichtige Information"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function DailyPlansPage({
  selectedUser,
  dayPlans,
  cookingPlans,
  importantInfos,
  onSaveDayPlan,
  onDeleteDayPlan,
  onSaveImportantInfo,
  onDeleteImportantInfo,
}) {
  const [dayPlanForm, setDayPlanForm] = useState(getDayPlanFormDefaults(selectedUser));
  const [editingDayPlanId, setEditingDayPlanId] = useState("");
  const [importantInfoForm, setImportantInfoForm] = useState(
    getImportantInfoFormDefaults(selectedUser, VACATION_START_KEY)
  );
  const [editingImportantInfoId, setEditingImportantInfoId] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (
      !dayPlanForm.date ||
      !dayPlanForm.title.trim() ||
      (!dayPlanForm.allDay &&
        (!dayPlanForm.startTime ||
          !dayPlanForm.endTime ||
          dayPlanForm.endTime <= dayPlanForm.startTime))
    ) {
      return;
    }

    onSaveDayPlan({
      id: editingDayPlanId || createId(),
      date: dayPlanForm.date,
      title: dayPlanForm.title.trim(),
      note: dayPlanForm.note.trim(),
      createdBy: dayPlanForm.createdBy,
      allDay: dayPlanForm.allDay,
      startTime: dayPlanForm.allDay ? "" : dayPlanForm.startTime,
      endTime: dayPlanForm.allDay ? "" : dayPlanForm.endTime,
    });

    setEditingDayPlanId("");
    setDayPlanForm(getDayPlanFormDefaults(selectedUser));
  }

  function handleImportantInfoSubmit(event) {
    event.preventDefault();

    if (!importantInfoForm.message.trim()) {
      return;
    }

    onSaveImportantInfo({
      id: editingImportantInfoId || createId(),
      date: importantInfoForm.date,
      person: importantInfoForm.person,
      message: importantInfoForm.message.trim(),
    });

    setEditingImportantInfoId("");
    setImportantInfoForm(getImportantInfoFormDefaults(selectedUser, importantInfoForm.date));
  }

  function startImportantInfoForDate(dateKey) {
    setEditingImportantInfoId("");
    setImportantInfoForm(getImportantInfoFormDefaults(selectedUser, dateKey));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleEditImportantInfo(entry) {
    setEditingImportantInfoId(entry.id);
    setImportantInfoForm({
      date: entry.date,
      person: entry.person,
      message: entry.message,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="page-stack">
      <PageHeader
        Icon={CalendarDays}
        title="Tagespläne"
        description="Hier können schon vor dem Urlaub Ideen, Programmpunkte und feste Termine wie in einem einfachen Urlaubskalender gesammelt werden."
      />

      <form className="editor-card" onSubmit={handleSubmit}>
        <div className="editor-card__title">
          <span>{editingDayPlanId ? "Kalendereintrag bearbeiten" : "Kalendereintrag hinzufügen"}</span>
          <Plus size={18} strokeWidth={1.9} />
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Datum</span>
            <select
              value={dayPlanForm.date}
              onChange={(event) =>
                setDayPlanForm((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
            >
              {VACATION_DAYS.map((dateKey) => (
                <option key={dateKey} value={dateKey}>
                  {formatVacationDayLabel(dateKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Eingetragen von</span>
            <select
              value={dayPlanForm.createdBy}
              onChange={(event) =>
                setDayPlanForm((current) => ({
                  ...current,
                  createdBy: event.target.value,
                }))
              }
            >
              {USERS.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Zeitraum</span>
            <select
              value={dayPlanForm.allDay ? "all-day" : "time-range"}
              onChange={(event) =>
                setDayPlanForm((current) => ({
                  ...current,
                  allDay: event.target.value === "all-day",
                  startTime: event.target.value === "all-day" ? "" : current.startTime,
                  endTime: event.target.value === "all-day" ? "" : current.endTime,
                }))
              }
            >
              <option value="all-day">Ganztägig</option>
              <option value="time-range">Von / bis</option>
            </select>
          </label>
        </div>

        {!dayPlanForm.allDay ? (
          <div className="field-grid">
            <label className="field">
              <span>Von</span>
              <input
                type="time"
                value={dayPlanForm.startTime}
                onChange={(event) =>
                  setDayPlanForm((current) => ({
                    ...current,
                    startTime: event.target.value,
                  }))
                }
              />
            </label>

            <label className="field">
              <span>Bis</span>
              <input
                type="time"
                value={dayPlanForm.endTime}
                onChange={(event) =>
                  setDayPlanForm((current) => ({
                    ...current,
                    endTime: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        ) : null}

        <label className="field">
          <span>Programmpunkt</span>
          <input
            type="text"
            placeholder="z. B. Bootstour oder gemeinsames Frühstück"
            value={dayPlanForm.title}
            onChange={(event) =>
              setDayPlanForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
          />
        </label>

        <label className="field">
          <span>Notiz</span>
          <textarea
            rows="3"
            placeholder="Optional, z. B. Ort, Treffpunkt oder Tisch reservieren"
            value={dayPlanForm.note}
            onChange={(event) =>
              setDayPlanForm((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
          />
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            {editingDayPlanId ? "Aktualisieren" : "Speichern"}
          </button>

          {editingDayPlanId ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditingDayPlanId("");
                setDayPlanForm(getDayPlanFormDefaults(selectedUser));
              }}
            >
              Abbrechen
            </button>
          ) : null}
        </div>
      </form>

      <ImportantInfoFormCard
        form={importantInfoForm}
        setForm={setImportantInfoForm}
        editingImportantInfoId={editingImportantInfoId}
        onSubmit={handleImportantInfoSubmit}
        onCancel={() => {
          setEditingImportantInfoId("");
          setImportantInfoForm(getImportantInfoFormDefaults(selectedUser, importantInfoForm.date));
        }}
        title="Wichtige Informationen"
        description="Hier kannst du tagesbezogene Hinweise für die Gruppe hinterlassen und auch direkt dem passenden Urlaubstag zuordnen."
      />

      {VACATION_DAYS.map((dateKey) => {
        const itemsForDay = getScheduleEntriesForDate(dateKey, dayPlans, cookingPlans);
        const infosForDay = getImportantInfosForDate(importantInfos, dateKey);

        return (
          <section className="list-section" key={dateKey}>
            <div className="section-heading">
              <h3>{formatVacationDayLabel(dateKey)}</h3>
              <span>{itemsForDay.length === 0 ? "Noch leer" : `${itemsForDay.length} Einträge`}</span>
            </div>

            {itemsForDay.length === 0 ? (
              <EmptyState text="Für diesen Tag gibt es noch keine Einträge." />
            ) : (
              <div className="stack">
                {itemsForDay.map((entry) => (
                  <article
                    className={`item-card ${entry.type === "meal" ? "item-card--yellow" : "item-card--neutral"}`}
                    key={entry.id}
                  >
                    <div>
                      <p className="item-card__title">{entry.title}</p>
                      <p className="item-card__meta">{entry.meta}</p>
                      {entry.note ? <p className="item-card__note">{entry.note}</p> : null}
                    </div>

                    {entry.type === "meal" ? (
                      <span className="status-pill">Aus Essensplan</span>
                    ) : (
                      <div className="item-actions">
                        <button
                          className="icon-button"
                          type="button"
                          aria-label="Kalendereintrag bearbeiten"
                          onClick={() => {
                            setEditingDayPlanId(entry.id);
                            setDayPlanForm({
                              date: dateKey,
                              title: entry.title,
                              note: entry.note,
                              createdBy: entry.createdBy || selectedUser,
                              allDay: entry.allDay ?? true,
                              startTime: entry.startTime ?? "",
                              endTime: entry.endTime ?? "",
                            });
                          }}
                        >
                          <PencilLine size={16} strokeWidth={1.9} />
                        </button>

                        <button
                          className="icon-button icon-button--danger"
                          type="button"
                          aria-label="Kalendereintrag löschen"
                          onClick={() => {
                            onDeleteDayPlan(entry.id);
                            if (editingDayPlanId === entry.id) {
                              setEditingDayPlanId("");
                              setDayPlanForm(getDayPlanFormDefaults(selectedUser));
                            }
                          }}
                        >
                          <Trash2 size={16} strokeWidth={1.9} />
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            <div className="day-subsection">
              <div className="field-header">
                <span className="subsection-label">Wichtige Informationen</span>
                <button
                  className="inline-action"
                  type="button"
                  onClick={() => startImportantInfoForDate(dateKey)}
                >
                  Info hinzufügen
                </button>
              </div>

              <ImportantInfoList
                entries={infosForDay}
                emptyText="Für diesen Tag gibt es noch keine wichtigen Informationen."
                onEdit={handleEditImportantInfo}
                onDelete={onDeleteImportantInfo}
              />
            </div>
          </section>
        );
      })}
    </section>
  );
}

function ShoppingListPage({ selectedUser, shoppingItems, onSaveShoppingItem, onDeleteShoppingItem, onToggleShoppingItem }) {
  const [shoppingForm, setShoppingForm] = useState(getShoppingFormDefaults(selectedUser));
  const [editingShoppingId, setEditingShoppingId] = useState("");

  const orderedItems = [...shoppingItems].sort((first, second) => Number(first.checked) - Number(second.checked));

  function handleSubmit(event) {
    event.preventDefault();

    if (!shoppingForm.item.trim()) {
      return;
    }

    onSaveShoppingItem({
      id: editingShoppingId || createId(),
      item: shoppingForm.item.trim(),
      addedBy: shoppingForm.addedBy,
      checked: shoppingItems.find((entry) => entry.id === editingShoppingId)?.checked ?? false,
      checkedBy: shoppingItems.find((entry) => entry.id === editingShoppingId)?.checkedBy ?? "",
    });

    setEditingShoppingId("");
    setShoppingForm(getShoppingFormDefaults(selectedUser));
  }

  return (
    <section className="page-stack">
      <PageHeader
        Icon={ShoppingCart}
        title="Einkaufsliste"
        description="Hier kommen alle Besorgungen rein. Links kann direkt abgehakt werden, sobald etwas erledigt ist."
      />

      <form className="editor-card editor-card--soft" onSubmit={handleSubmit}>
        <div className="editor-card__title">
          <span>{editingShoppingId ? "Eintrag bearbeiten" : "Eintrag hinzufügen"}</span>
          <Plus size={18} strokeWidth={1.9} />
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Gegenstand</span>
            <input
              type="text"
              placeholder="z. B. Wasser, Obst oder Kohle"
              value={shoppingForm.item}
              onChange={(event) =>
                setShoppingForm((current) => ({
                  ...current,
                  item: event.target.value,
                }))
              }
            />
          </label>

          <label className="field">
            <span>Eingetragen von</span>
            <select
              value={shoppingForm.addedBy}
              onChange={(event) =>
                setShoppingForm((current) => ({
                  ...current,
                  addedBy: event.target.value,
                }))
              }
            >
              {USERS.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            {editingShoppingId ? "Aktualisieren" : "Speichern"}
          </button>

          {editingShoppingId ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditingShoppingId("");
                setShoppingForm(getShoppingFormDefaults(selectedUser));
              }}
            >
              Abbrechen
            </button>
          ) : null}
        </div>
      </form>

      {orderedItems.length === 0 ? (
        <EmptyState text="Noch nichts auf der Einkaufsliste." />
      ) : (
        <div className="stack">
          {orderedItems.map((item) => (
            <article className={`item-card ${item.checked ? "item-card--checked" : "item-card--soft"}`} key={item.id}>
              <div className="checklist-card">
                <button
                  className={`check-button ${item.checked ? "check-button--checked" : ""}`}
                  type="button"
                  aria-label={item.checked ? "Erledigt entfernen" : "Als erledigt markieren"}
                  onClick={() => onToggleShoppingItem(item.id, selectedUser)}
                >
                  {item.checked ? (
                    <CircleCheckBig size={20} strokeWidth={1.9} />
                  ) : (
                    <Circle size={20} strokeWidth={1.9} />
                  )}
                </button>

                <div className="checklist-card__content">
                  <p className={`item-card__title ${item.checked ? "item-card__title--checked" : ""}`}>{item.item}</p>
                  <p className="item-card__meta">Von {item.addedBy}</p>
                  {item.checkedBy ? <p className="item-card__note">Abgehakt von {item.checkedBy}</p> : null}
                </div>
              </div>

              <div className="item-actions">
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Einkaufseintrag bearbeiten"
                  onClick={() => {
                    setEditingShoppingId(item.id);
                    setShoppingForm({
                      item: item.item,
                      addedBy: item.addedBy,
                    });
                  }}
                >
                  <PencilLine size={16} strokeWidth={1.9} />
                </button>

                <button
                  className="icon-button icon-button--danger"
                  type="button"
                  aria-label="Einkaufseintrag löschen"
                  onClick={() => {
                    onDeleteShoppingItem(item.id);
                    if (editingShoppingId === item.id) {
                      setEditingShoppingId("");
                      setShoppingForm(getShoppingFormDefaults(selectedUser));
                    }
                  }}
                >
                  <Trash2 size={16} strokeWidth={1.9} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PackingListPage({ selectedUser, packingItems, onSavePackingItem, onDeletePackingItem }) {
  const [packingForm, setPackingForm] = useState(getPackingFormDefaults(selectedUser));
  const [editingPackingId, setEditingPackingId] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!packingForm.item.trim()) {
      return;
    }

    onSavePackingItem({
      id: editingPackingId || createId(),
      item: packingForm.item.trim(),
      person: packingForm.person,
      category: packingForm.category,
    });

    setEditingPackingId("");
    setPackingForm(getPackingFormDefaults(selectedUser));
  }

  return (
    <section className="page-stack">
      <PageHeader
        Icon={Backpack}
        title="Packliste"
        description="Halte fest, wer was mitbringt, damit Essen, Spiele und der Rest sauber verteilt bleiben."
      />

      <form className="editor-card editor-card--green" onSubmit={handleSubmit}>
        <div className="editor-card__title">
          <span>{editingPackingId ? "Gepäck bearbeiten" : "Eintrag hinzufügen"}</span>
          <Plus size={18} strokeWidth={1.9} />
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Gegenstand</span>
            <input
              type="text"
              placeholder="z. B. Pavillon"
              value={packingForm.item}
              onChange={(event) =>
                setPackingForm((current) => ({
                  ...current,
                  item: event.target.value,
                }))
              }
            />
          </label>

          <label className="field">
            <span>Person</span>
            <select
              value={packingForm.person}
              onChange={(event) =>
                setPackingForm((current) => ({
                  ...current,
                  person: event.target.value,
                }))
              }
            >
              {USERS.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Kategorie</span>
          <select
            value={packingForm.category}
            onChange={(event) =>
              setPackingForm((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
          >
            {PACKING_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            {editingPackingId ? "Aktualisieren" : "Speichern"}
          </button>

          {editingPackingId ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditingPackingId("");
                setPackingForm(getPackingFormDefaults(selectedUser));
              }}
            >
              Abbrechen
            </button>
          ) : null}
        </div>
      </form>

      {PACKING_CATEGORIES.map((category) => {
        const categoryItems = packingItems.filter((item) => item.category === category);

        return (
          <section className="list-section" key={category}>
            <div className="section-heading">
              <h3>{category}</h3>
            </div>

            {categoryItems.length === 0 ? (
              <EmptyState text="Noch keine Einträge in dieser Kategorie." />
            ) : (
              <div className="stack">
                {categoryItems.map((item) => (
                  <article className="item-card item-card--green" key={item.id}>
                    <div>
                      <p className="item-card__title">{item.item}</p>
                      <p className="item-card__meta">{item.person}</p>
                    </div>

                    <div className="item-actions">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label="Packeintrag bearbeiten"
                        onClick={() => {
                          setEditingPackingId(item.id);
                          setPackingForm({
                            item: item.item,
                            person: item.person,
                            category: item.category,
                          });
                        }}
                      >
                        <PencilLine size={16} strokeWidth={1.9} />
                      </button>

                      <button
                        className="icon-button icon-button--danger"
                        type="button"
                        aria-label="Packeintrag löschen"
                        onClick={() => {
                          onDeletePackingItem(item.id);
                          if (editingPackingId === item.id) {
                            setEditingPackingId("");
                            setPackingForm(getPackingFormDefaults(selectedUser));
                          }
                        }}
                      >
                        <Trash2 size={16} strokeWidth={1.9} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}

function FinancePage({ selectedUser, financeExpenses, onSaveFinanceExpense, onDeleteFinanceExpense, onToggleRepayment }) {
  const [financeForm, setFinanceForm] = useState(getFinanceFormDefaults(selectedUser));
  const [editingFinanceId, setEditingFinanceId] = useState("");

  const myExpenses = financeExpenses
    .filter((expense) => expense.paidBy === selectedUser)
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  const relevantForMe = financeExpenses
    .filter((expense) => expense.relevantUsers.includes(selectedUser))
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  const balanceSummary = getBalanceSummary(selectedUser, financeExpenses);
  const previewAmountNumber = Number(financeForm.amount.replace(",", "."));
  const previewAmountCents =
    Number.isFinite(previewAmountNumber) && previewAmountNumber > 0
      ? Math.round(previewAmountNumber * 100)
      : 0;
  const previewParticipantCount =
    financeForm.relevantUsers.length + (financeForm.includePayerShare ? 1 : 0);
  const previewShareMap =
    previewAmountCents > 0 && previewParticipantCount > 0
      ? getExpenseShareMap({
          paidBy: selectedUser,
          relevantUsers: financeForm.relevantUsers,
          includePayerShare: financeForm.includePayerShare,
          amountCents: previewAmountCents,
        })
      : {};
  const previewMyShareCents = financeForm.includePayerShare
    ? previewAmountCents - Object.values(previewShareMap).reduce((sum, cents) => sum + cents, 0)
    : 0;

  function toggleRelevantUser(person) {
    setFinanceForm((current) => {
      const exists = current.relevantUsers.includes(person);

      return {
        ...current,
        relevantUsers: exists
          ? current.relevantUsers.filter((entry) => entry !== person)
          : [...current.relevantUsers, person],
      };
    });
  }

  function handleSelectAll() {
    setFinanceForm((current) => {
      const allOthers = USERS.filter((person) => person !== current.paidBy);
      const allSelected = allOthers.every((person) => current.relevantUsers.includes(person));

      return {
        ...current,
        relevantUsers: allSelected ? [] : allOthers,
      };
    });
  }

  function handleSubmit(event) {
    event.preventDefault();

    const amountNumber = Number(financeForm.amount.replace(",", "."));
    const previousExpense = financeExpenses.find((expense) => expense.id === editingFinanceId);

    if (!financeForm.title.trim() || !Number.isFinite(amountNumber) || amountNumber <= 0 || financeForm.relevantUsers.length === 0) {
      return;
    }

    onSaveFinanceExpense({
      id: editingFinanceId || createId(),
      title: financeForm.title.trim(),
      note: financeForm.note.trim(),
      paidBy: selectedUser,
      relevantUsers: financeForm.relevantUsers,
      includePayerShare: financeForm.includePayerShare,
      amountCents: Math.round(amountNumber * 100),
      createdAt: editingFinanceId
        ? previousExpense?.createdAt ?? new Date().toISOString()
        : new Date().toISOString(),
      settledBy: Object.fromEntries(
        financeForm.relevantUsers.map((person) => [person, Boolean(previousExpense?.settledBy?.[person])])
      ),
    });

    setEditingFinanceId("");
    setFinanceForm(getFinanceFormDefaults(selectedUser));
  }

  return (
    <section className="page-stack">
      <PageHeader
        Icon={Wallet}
        title="Finanzen"
        description="Hier könnt ihr Ausgaben eintragen, auf die beteiligten Personen aufteilen und offene Beträge ganz entspannt im Blick behalten."
      />

      <form className="editor-card editor-card--sand" onSubmit={handleSubmit}>
        <div className="editor-card__title">
          <span>{editingFinanceId ? "Kosten bearbeiten" : "Kosten hinzufügen"}</span>
          <Receipt size={18} strokeWidth={1.9} />
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Wofür</span>
            <input
              type="text"
              placeholder="z. B. Restaurant, Tanken oder Großeinkauf"
              value={financeForm.title}
              onChange={(event) =>
                setFinanceForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </label>

          <label className="field">
            <span>Betrag in Euro</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="z. B. 48,50"
              value={financeForm.amount}
              onChange={(event) =>
                setFinanceForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <label className="field">
          <span>Bezahlt von</span>
          <input type="text" value={selectedUser} disabled />
        </label>

        <div className="field">
          <div className="field-header">
            <span>Betrifft</span>
            <button className="inline-action" type="button" onClick={handleSelectAll}>
              Alle
            </button>
          </div>

          <div className="traveler-grid">
            {USERS.filter((person) => person !== selectedUser).map((person) => (
              <button
                className={`traveler-chip ${financeForm.relevantUsers.includes(person) ? "traveler-chip--active" : ""}`}
                key={person}
                type="button"
                onClick={() => toggleRelevantUser(person)}
              >
                {person}
              </button>
            ))}
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={financeForm.includePayerShare}
            onChange={(event) =>
              setFinanceForm((current) => ({
                ...current,
                includePayerShare: event.target.checked,
              }))
            }
          />
          <span>Ich habe einen eigenen Anteil an diesen Kosten</span>
        </label>

        {previewAmountCents > 0 && financeForm.relevantUsers.length > 0 ? (
          <p className="helper-text">
            {financeForm.includePayerShare
              ? `Aufgeteilt auf ${previewParticipantCount} Personen. Dein Anteil: ${formatCurrency(previewMyShareCents)}. Die anderen schulden dir zusammen ${formatCurrency(previewAmountCents - previewMyShareCents)}.`
              : `Ohne eigenen Anteil. Die ausgewählten Personen schulden dir zusammen ${formatCurrency(previewAmountCents)}.`}
          </p>
        ) : null}

        <label className="field">
          <span>Notiz</span>
          <textarea
            rows="3"
            placeholder="Optional, z. B. wer dabei war oder was genau bezahlt wurde"
            value={financeForm.note}
            onChange={(event) =>
              setFinanceForm((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
          />
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            {editingFinanceId ? "Aktualisieren" : "Speichern"}
          </button>

          {editingFinanceId ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditingFinanceId("");
                setFinanceForm(getFinanceFormDefaults(selectedUser));
              }}
            >
              Abbrechen
            </button>
          ) : null}
        </div>
      </form>

      <section className="list-section">
        <div className="section-heading">
          <h3>Für dich relevant</h3>
        </div>

        {relevantForMe.length === 0 ? (
          <EmptyState text="Aktuell gibt es keine Kosten, die dich betreffen." />
        ) : (
          <div className="stack">
            {relevantForMe.map((expense) => {
              const shareMap = getExpenseShareMap(expense);
              const isSettled = Boolean(expense.settledBy[selectedUser]);

              return (
                <article className={`item-card ${isSettled ? "item-card--checked" : "item-card--sand"}`} key={expense.id}>
                  <div>
                    <p className="item-card__title">{expense.title}</p>
                    <p className="item-card__meta">
                      {formatCurrency(shareMap[selectedUser] ?? 0)} an {expense.paidBy}
                    </p>
                    <p className="item-card__meta">{formatDateTimeLabel(expense.createdAt)}</p>
                    {expense.note ? <p className="item-card__note">{expense.note}</p> : null}
                  </div>

                  <span className="status-pill">
                    {isSettled ? "Bezahlt" : "Offen"}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="list-section">
        <div className="section-heading">
          <h3>Meine Ausgaben</h3>
        </div>

        {myExpenses.length === 0 ? (
          <EmptyState text="Du hast noch keine Kosten eingetragen." />
        ) : (
          <div className="stack">
            {myExpenses.map((expense) => {
              const shareMap = getExpenseShareMap(expense);

              return (
                <article className="item-card item-card--sand" key={expense.id}>
                  <div className="finance-card">
                    <div>
                      <p className="item-card__title">{expense.title}</p>
                      <p className="item-card__meta">
                        {formatCurrency(expense.amountCents)} · offen {formatCurrency(getOpenAmountForExpense(expense))}
                      </p>
                      <p className="item-card__meta">
                        {expense.includePayerShare
                          ? `Mit eigenem Anteil · ${getExpenseParticipantCount(expense)} Personen`
                          : `Ohne eigenen Anteil · ${expense.relevantUsers.length} Personen`}
                      </p>
                      <p className="item-card__meta">{formatDateTimeLabel(expense.createdAt)}</p>
                      {expense.note ? <p className="item-card__note">{expense.note}</p> : null}
                    </div>

                    <div className="repayment-list">
                      {expense.relevantUsers.map((person) => (
                        <label className="repayment-item" key={person}>
                          <input
                            type="checkbox"
                            checked={Boolean(expense.settledBy[person])}
                            onChange={() => onToggleRepayment(expense.id, person)}
                          />
                          <span>
                            {person} · {formatCurrency(shareMap[person] ?? 0)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="item-actions">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Kosten bearbeiten"
                      onClick={() => {
                        setEditingFinanceId(expense.id);
                        setFinanceForm({
                          title: expense.title,
                          amount: String((expense.amountCents / 100).toFixed(2)).replace(".", ","),
                          note: expense.note,
                          paidBy: expense.paidBy,
                          relevantUsers: expense.relevantUsers,
                          includePayerShare: expense.includePayerShare,
                        });
                      }}
                    >
                      <PencilLine size={16} strokeWidth={1.9} />
                    </button>

                    <button
                      className="icon-button icon-button--danger"
                      type="button"
                      aria-label="Kosten löschen"
                      onClick={() => {
                        onDeleteFinanceExpense(expense.id);
                        if (editingFinanceId === expense.id) {
                          setEditingFinanceId("");
                          setFinanceForm(getFinanceFormDefaults(selectedUser));
                        }
                      }}
                    >
                      <Trash2 size={16} strokeWidth={1.9} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="list-section">
        <div className="section-heading">
          <h3>Saldoübersicht</h3>
        </div>

        {balanceSummary.length === 0 ? (
          <EmptyState text="Aktuell gibt es keine offenen Salden für dich." />
        ) : (
          <div className="stack">
            {balanceSummary.map((entry) => (
              <article className="item-card item-card--neutral" key={entry.person}>
                <div>
                  <p className="item-card__title">{entry.person}</p>
                  <p className="item-card__meta">
                    {entry.cents > 0
                      ? `${entry.person} schuldet dir ${formatCurrency(entry.cents)}`
                      : `Du schuldest ${entry.person} ${formatCurrency(Math.abs(entry.cents))}`}
                  </p>
                </div>

                <span className="status-pill">
                  {formatCurrency(Math.abs(entry.cents))}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function CookingPlanPage({ selectedUser, cookingPlans, onSaveCookingPlan, onDeleteCookingPlan }) {
  const [cookingForm, setCookingForm] = useState(getCookingFormDefaults(selectedUser));
  const [editingCookingId, setEditingCookingId] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!cookingForm.day || !cookingForm.gericht.trim()) {
      return;
    }

    onSaveCookingPlan({
      id: editingCookingId || createId(),
      day: cookingForm.day,
      gericht: cookingForm.gericht.trim(),
      personOne: cookingForm.personOne,
      personTwo: cookingForm.personTwo,
    });

    setEditingCookingId("");
    setCookingForm(getCookingFormDefaults(selectedUser));
  }

  return (
    <section className="page-stack">
      <PageHeader
        Icon={CookingPot}
        title="Essensplan"
        description="Plane, was an welchem Urlaubstag gekocht wird und welche zwei Personen dafür verantwortlich sind."
      />

      <form className="editor-card editor-card--yellow" onSubmit={handleSubmit}>
        <div className="editor-card__title">
          <span>{editingCookingId ? "Mahlzeit bearbeiten" : "Mahlzeit hinzufügen"}</span>
          <Plus size={18} strokeWidth={1.9} />
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Datum</span>
            <select
              value={cookingForm.day}
              onChange={(event) =>
                setCookingForm((current) => ({
                  ...current,
                  day: event.target.value,
                }))
              }
            >
              {VACATION_DAYS.map((dateKey) => (
                <option key={dateKey} value={dateKey}>
                  {formatVacationDayLabel(dateKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Gericht</span>
            <input
              type="text"
              placeholder="z. B. Spaghetti Bolognese"
              value={cookingForm.gericht}
              onChange={(event) =>
                setCookingForm((current) => ({
                  ...current,
                  gericht: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Person 1</span>
            <select
              value={cookingForm.personOne}
              onChange={(event) =>
                setCookingForm((current) => {
                  const nextPersonOne = event.target.value;

                  return {
                    ...current,
                    personOne: nextPersonOne,
                    personTwo:
                      current.personTwo === nextPersonOne
                        ? getAlternateUser(nextPersonOne)
                        : current.personTwo,
                  };
                })
              }
            >
              {USERS.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Person 2</span>
            <select
              value={cookingForm.personTwo}
              onChange={(event) =>
                setCookingForm((current) => {
                  const nextPersonTwo = event.target.value;

                  return {
                    ...current,
                    personTwo: nextPersonTwo,
                    personOne:
                      current.personOne === nextPersonTwo
                        ? getAlternateUser(nextPersonTwo)
                        : current.personOne,
                  };
                })
              }
            >
              {USERS.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            {editingCookingId ? "Aktualisieren" : "Speichern"}
          </button>

          {editingCookingId ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditingCookingId("");
                setCookingForm(getCookingFormDefaults(selectedUser));
              }}
            >
              Abbrechen
            </button>
          ) : null}
        </div>
      </form>

      {cookingPlans.length === 0 ? (
        <EmptyState text="Noch keine Mahlzeiten geplant." />
      ) : (
        <div className="stack">
          {cookingPlans.map((entry) => (
            <article className="item-card item-card--yellow" key={entry.id}>
              <div>
                <p className="item-card__title">{entry.gericht}</p>
                <p className="item-card__meta">
                  {formatVacationDayLabel(entry.day)} · {entry.personOne} und {entry.personTwo}
                </p>
              </div>

              <div className="item-actions">
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Essensplan bearbeiten"
                  onClick={() => {
                    setEditingCookingId(entry.id);
                    setCookingForm({
                      day: entry.day,
                      gericht: entry.gericht,
                      personOne: entry.personOne,
                      personTwo: entry.personTwo,
                    });
                  }}
                >
                  <PencilLine size={16} strokeWidth={1.9} />
                </button>

                <button
                  className="icon-button icon-button--danger"
                  type="button"
                  aria-label="Essensplan löschen"
                  onClick={() => {
                    onDeleteCookingPlan(entry.id);
                    if (editingCookingId === entry.id) {
                      setEditingCookingId("");
                      setCookingForm(getCookingFormDefaults(selectedUser));
                    }
                  }}
                >
                  <Trash2 size={16} strokeWidth={1.9} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AllergiesPage({ selectedUser, allergies, onSaveAllergy, onDeleteAllergy }) {
  const [allergyForm, setAllergyForm] = useState(getAllergyFormDefaults(selectedUser));
  const [editingAllergyId, setEditingAllergyId] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!allergyForm.person || !allergyForm.allergy.trim()) {
      return;
    }

    onSaveAllergy({
      id: editingAllergyId || createId(),
      person: allergyForm.person,
      allergy: allergyForm.allergy.trim(),
    });

    setEditingAllergyId("");
    setAllergyForm(getAllergyFormDefaults(selectedUser));
  }

  return (
    <section className="page-stack">
      <PageHeader
        Icon={BadgeAlert}
        title="Allergien"
        description="Halte Allergien und Unverträglichkeiten für die Gruppe zentral und schnell lesbar fest."
      />

      <form className="editor-card editor-card--coral" onSubmit={handleSubmit}>
        <div className="editor-card__title">
          <span>{editingAllergyId ? "Hinweis bearbeiten" : "Hinweis hinzufügen"}</span>
          <Plus size={18} strokeWidth={1.9} />
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Person</span>
            <select
              value={allergyForm.person}
              onChange={(event) =>
                setAllergyForm((current) => ({
                  ...current,
                  person: event.target.value,
                }))
              }
            >
              {USERS.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Allergie / Unverträglichkeit</span>
            <input
              type="text"
              placeholder="z. B. Nüsse oder keine"
              value={allergyForm.allergy}
              onChange={(event) =>
                setAllergyForm((current) => ({
                  ...current,
                  allergy: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            {editingAllergyId ? "Aktualisieren" : "Speichern"}
          </button>

          {editingAllergyId ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditingAllergyId("");
                setAllergyForm(getAllergyFormDefaults(selectedUser));
              }}
            >
              Abbrechen
            </button>
          ) : null}
        </div>
      </form>

      {allergies.length === 0 ? (
        <EmptyState text="Noch keine Allergiehinweise vorhanden." />
      ) : (
        <div className="stack">
          {allergies.map((entry) => (
            <article className="item-card item-card--coral" key={entry.id}>
              <div>
                <p className="item-card__title">{entry.person}</p>
                <p className="item-card__meta">{entry.allergy}</p>
              </div>

              <div className="item-actions">
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Allergiehinweis bearbeiten"
                  onClick={() => {
                    setEditingAllergyId(entry.id);
                    setAllergyForm({
                      person: entry.person,
                      allergy: entry.allergy,
                    });
                  }}
                >
                  <PencilLine size={16} strokeWidth={1.9} />
                </button>

                <button
                  className="icon-button icon-button--danger"
                  type="button"
                  aria-label="Allergiehinweis löschen"
                  onClick={() => {
                    onDeleteAllergy(entry.id);
                    if (editingAllergyId === entry.id) {
                      setEditingAllergyId("");
                      setAllergyForm(getAllergyFormDefaults(selectedUser));
                    }
                  }}
                >
                  <Trash2 size={16} strokeWidth={1.9} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function NameSelection({ onSelectUser }) {
  return (
    <div className="selection-screen">
      <div className="selection-card">
        <p className="selection-card__eyebrow">KROATIEN</p>
        <h1>Wer bist du?</h1>
        <p className="selection-card__text">
          Wähle deinen Namen einmal aus. Danach bleibt die Auswahl lokal auf diesem Gerät gespeichert.
        </p>

        <div className="selection-grid">
          {USERS.map((person) => (
            <button
              className="selection-button"
              key={person}
              type="button"
              onClick={() => onSelectUser(person)}
            >
              {person}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingState({ title, text }) {
  return (
    <div className="selection-screen">
      <div className="selection-card">
        <p className="selection-card__eyebrow">DATEN</p>
        <h1>{title}</h1>
        <p className="selection-card__text">{text}</p>
      </div>
    </div>
  );
}

function App() {
  const [selectedUser, setSelectedUser] = useState(() => {
    const savedUser = window.localStorage.getItem(STORAGE_KEYS.username);
    return savedUser && USERS.includes(savedUser) ? savedUser : "";
  });
  const [route, setRoute] = useState(() => normalizeRoute(window.location.pathname));
  const [previewDate, setPreviewDate] = useState(() =>
    getPreviewDateFromSearch(window.location.search)
  );
  const [now, setNow] = useState(new Date());
  const [arrivalGroups, setArrivalGroups, isArrivalGroupsHydrated] = usePersistentState(
    STORAGE_KEYS.arrivalGroups,
    getInitialArrivalGroups(),
    normalizeArrivalGroups
  );
  const [dayPlans, setDayPlans, isDayPlansHydrated] = usePersistentState(
    STORAGE_KEYS.dayPlans,
    [],
    normalizeDayPlans
  );
  const [travelInfo, setTravelInfo, isTravelInfoHydrated] = usePersistentState(
    STORAGE_KEYS.travelInfo,
    EMPTY_TRAVEL_INFO,
    normalizeTravelInfo
  );
  const [importantInfos, setImportantInfos, isImportantInfosHydrated] = usePersistentState(
    STORAGE_KEYS.importantInfos,
    [],
    normalizeImportantInfos
  );
  const [shoppingItems, setShoppingItems, isShoppingItemsHydrated] = usePersistentState(
    STORAGE_KEYS.shoppingItems,
    [],
    normalizeShoppingItems
  );
  const [packingItems, setPackingItems, isPackingItemsHydrated] = usePersistentState(
    STORAGE_KEYS.packingItems,
    [],
    normalizePackingItems
  );
  const [cookingPlans, setCookingPlans, isCookingPlansHydrated] = usePersistentState(
    STORAGE_KEYS.cookingPlans,
    [],
    normalizeCookingPlans
  );
  const [financeExpenses, setFinanceExpenses, isFinanceExpensesHydrated] = usePersistentState(
    STORAGE_KEYS.financeExpenses,
    [],
    normalizeFinanceExpenses
  );
  const [allergies, setAllergies, isAllergiesHydrated] = usePersistentState(
    STORAGE_KEYS.allergies,
    []
  );

  useEffect(() => {
    const updateTime = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(updateTime);
  }, []);

  useEffect(() => {
    function handlePopState() {
      setRoute(normalizeRoute(window.location.pathname));
      setPreviewDate(getPreviewDateFromSearch(window.location.search));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigateTo(path) {
    const nextRoute = normalizeRoute(path);

    if (nextRoute === route) {
      return;
    }

    window.history.pushState({}, "", `${nextRoute}${window.location.search}`);
    setRoute(nextRoute);
    window.scrollTo({ top: 0 });
  }

  function handleSelectUser(person) {
    window.localStorage.setItem(STORAGE_KEYS.username, person);
    setSelectedUser(person);
  }

  function resetSelectedUser() {
    window.localStorage.removeItem(STORAGE_KEYS.username);
    setSelectedUser("");
  }

  function upsertById(setter, nextEntry) {
    setter((current) => {
      const exists = current.some((entry) => entry.id === nextEntry.id);

      if (exists) {
        return current.map((entry) => (entry.id === nextEntry.id ? nextEntry : entry));
      }

      return [...current, nextEntry];
    });
  }

  if (!selectedUser) {
    return <NameSelection onSelectUser={handleSelectUser} />;
  }

  const isAppHydrated = [
    isArrivalGroupsHydrated,
    isDayPlansHydrated,
    isTravelInfoHydrated,
    isImportantInfosHydrated,
    isShoppingItemsHydrated,
    isPackingItemsHydrated,
    isCookingPlansHydrated,
    isFinanceExpensesHydrated,
    isAllergiesHydrated,
  ].every(Boolean);

  if (!isAppHydrated) {
    return (
      <LoadingState
        title="Daten werden geladen"
        text={`Die App synchronisiert gerade den aktuellen Stand über ${getStorageDriverSummary()}.`}
      />
    );
  }

  const activeDate = previewDate ?? now;
  const isVacationStarted = activeDate >= VACATION_START;
  const currentDateKey = formatDateKey(activeDate);
  const isDuringVacation =
    currentDateKey >= VACATION_START_KEY && currentDateKey <= VACATION_END_KEY;
  const showArrivalSection = currentDateKey <= VACATION_START_KEY;
  const daysUntilVacation = formatCountdown(activeDate);
  const homeCards = getHomeCards(
    dayPlans,
    shoppingItems,
    packingItems,
    cookingPlans,
    financeExpenses,
    allergies,
    showArrivalSection
  );
  const homeScheduleEntries = getHomeScheduleEntries(
    currentDateKey,
    dayPlans,
    cookingPlans,
    isDuringVacation
  );

  let pageContent;

  if (route === "/arrival-times" || route === "/travel-info") {
    pageContent = (
      <ArrivalTimesPage
        key={`arrival-${selectedUser}`}
        selectedUser={selectedUser}
        arrivalGroups={arrivalGroups}
        travelInfo={travelInfo}
        onSaveArrivalGroup={(entry) => upsertById(setArrivalGroups, entry)}
        onDeleteArrivalGroup={(id) =>
          setArrivalGroups((current) => current.filter((entry) => entry.id !== id))
        }
        onSaveTravelInfo={setTravelInfo}
      />
    );
  } else if (route === "/daily-plans") {
    pageContent = (
      <DailyPlansPage
        key={selectedUser}
        selectedUser={selectedUser}
        dayPlans={dayPlans}
        cookingPlans={cookingPlans}
        importantInfos={importantInfos}
        onSaveDayPlan={(entry) => upsertById(setDayPlans, entry)}
        onDeleteDayPlan={(id) => setDayPlans((current) => current.filter((entry) => entry.id !== id))}
        onSaveImportantInfo={(entry) => upsertById(setImportantInfos, entry)}
        onDeleteImportantInfo={(id) =>
          setImportantInfos((current) => current.filter((entry) => entry.id !== id))
        }
      />
    );
  } else if (route === "/shopping-list") {
    pageContent = (
      <ShoppingListPage
        key={selectedUser}
        selectedUser={selectedUser}
        shoppingItems={shoppingItems}
        onSaveShoppingItem={(entry) => upsertById(setShoppingItems, entry)}
        onDeleteShoppingItem={(id) =>
          setShoppingItems((current) => current.filter((entry) => entry.id !== id))
        }
        onToggleShoppingItem={(id, person) =>
          setShoppingItems((current) =>
            current.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    checked: !entry.checked,
                    checkedBy: entry.checked ? "" : person,
                  }
                : entry
            )
          )
        }
      />
    );
  } else if (route === "/packing-list") {
    pageContent = (
      <PackingListPage
        key={selectedUser}
        selectedUser={selectedUser}
        packingItems={packingItems}
        onSavePackingItem={(entry) => upsertById(setPackingItems, entry)}
        onDeletePackingItem={(id) =>
          setPackingItems((current) => current.filter((entry) => entry.id !== id))
        }
      />
    );
  } else if (route === "/cooking-plan") {
    pageContent = (
      <CookingPlanPage
        key={selectedUser}
        selectedUser={selectedUser}
        cookingPlans={cookingPlans}
        onSaveCookingPlan={(entry) => upsertById(setCookingPlans, entry)}
        onDeleteCookingPlan={(id) =>
          setCookingPlans((current) => current.filter((entry) => entry.id !== id))
        }
      />
    );
  } else if (route === "/finanzen") {
    pageContent = (
      <FinancePage
        key={selectedUser}
        selectedUser={selectedUser}
        financeExpenses={financeExpenses}
        onSaveFinanceExpense={(entry) => upsertById(setFinanceExpenses, entry)}
        onDeleteFinanceExpense={(id) =>
          setFinanceExpenses((current) => current.filter((entry) => entry.id !== id))
        }
        onToggleRepayment={(expenseId, person) =>
          setFinanceExpenses((current) =>
            current.map((entry) =>
              entry.id === expenseId
                ? {
                    ...entry,
                    settledBy: {
                      ...entry.settledBy,
                      [person]: !entry.settledBy[person],
                    },
                  }
                : entry
            )
          )
        }
      />
    );
  } else if (route === "/allergies") {
    pageContent = (
      <AllergiesPage
        key={selectedUser}
        selectedUser={selectedUser}
        allergies={allergies}
        onSaveAllergy={(entry) => upsertById(setAllergies, entry)}
        onDeleteAllergy={(id) =>
          setAllergies((current) => current.filter((entry) => entry.id !== id))
        }
      />
    );
  } else {
    pageContent = (
      <section className="page-stack">
        <section className="hero">
          <p className="location">{isVacationStarted ? formatShortDate(activeDate) : "KROATIEN"}</p>
          <h1>{isVacationStarted ? "Kroatien 2026" : "Urlaub 2026"}</h1>
        </section>

        {isVacationStarted ? (
          <ImportantInfoSection
            key={`${selectedUser}-${currentDateKey}`}
            currentDateKey={getValidVacationDateKey(currentDateKey)}
            selectedUser={selectedUser}
            importantInfos={importantInfos}
            onSaveImportantInfo={(entry) => upsertById(setImportantInfos, entry)}
            onDeleteImportantInfo={(id) =>
              setImportantInfos((current) => current.filter((entry) => entry.id !== id))
            }
            onOpenAllDays={() => navigateTo("/daily-plans")}
          />
        ) : (
          <section className="countdown-card">
            <p className="countdown-label">NOCH</p>
            <h2>{daysUntilVacation}</h2>
            <p className="countdown-days">TAGE</p>
            <p className="countdown-subtitle">bis zum Urlaub</p>
          </section>
        )}

        {showArrivalSection ? (
          <section className="widget-grid">
            <ArrivalOverviewWidget
              arrivalGroups={arrivalGroups}
              travelInfo={travelInfo}
              onOpen={() => navigateTo("/arrival-times")}
            />
          </section>
        ) : null}

        <section className="list-section">
          <div className="section-heading">
            <h3>{isDuringVacation ? `HEUTE · ${formatVacationDayLabel(currentDateKey)}` : "KALENDER"}</h3>
            <PreviewLink text="Alle Tage" onClick={() => navigateTo("/daily-plans")} />
          </div>

          {homeScheduleEntries.length === 0 ? (
            <EmptyState
              text={
                isDuringVacation
                  ? "Für heute gibt es noch keine Tagespunkte."
                  : "Noch keine Tagespläne eingetragen."
              }
            />
          ) : (
            <div className="stack">
              {homeScheduleEntries.map((entry) => (
                <article className="item-card item-card--neutral" key={entry.id}>
                  <div>
                    <p className="item-card__title">{entry.title}</p>
                    <p className="item-card__meta">
                      {formatVacationDayLabel(entry.date)} · {entry.meta}
                    </p>
                    {entry.note ? <p className="item-card__note">{entry.note}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="home-section">
          <div className="section-heading">
            <h3>PLANUNG</h3>
          </div>

          <div className="menu">
            {homeCards.map((card) => (
              <button
                className={`card card--${card.color}`}
                key={card.path}
                type="button"
                onClick={() => navigateTo(card.path)}
              >
                <span className="card__icon">
                  <card.Icon size={24} strokeWidth={1.9} />
                </span>

                <div>
                  <h4>{card.title}</h4>
                  <p>{card.subtitle}</p>
                </div>

                <span className="card__arrow">
                  <ChevronRight size={22} strokeWidth={1.9} />
                </span>
              </button>
            ))}
          </div>
        </section>
      </section>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <div className="user-badge">
            <UserRound size={16} strokeWidth={1.9} />
            <span>{selectedUser}</span>
          </div>

          <button className="switch-user" type="button" onClick={resetSelectedUser}>
            Wechseln
          </button>
        </header>

        <main className="app-content">{pageContent}</main>

        <nav className="bottom-nav" aria-label="Navigation">
          {[
            { path: "/", label: "Start", Icon: House },
            ...(showArrivalSection
              ? [{ path: "/arrival-times", label: "Anreise", Icon: CarFront }]
              : []),
            ...(showArrivalSection
              ? [{ path: "/packing-list", label: "Packen", Icon: Backpack }]
              : []),
            { path: "/daily-plans", label: "Tage", Icon: CalendarDays },
            { path: "/shopping-list", label: "Einkauf", Icon: ShoppingCart },
            { path: "/cooking-plan", label: "Essen", Icon: CookingPot },
            { path: "/finanzen", label: "Finanzen", Icon: Wallet },
            { path: "/allergies", label: "Allergien", Icon: BadgeAlert },
          ].map((item) => (
            <button
              className={`nav-item ${
                route === item.path || (item.path === "/arrival-times" && route === "/travel-info")
                  ? "nav-item--active"
                  : ""
              }`}
              key={item.path}
              type="button"
              onClick={() => navigateTo(item.path)}
            >
              <item.Icon size={18} strokeWidth={1.9} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default App;
