const STORAGE_DRIVER = import.meta.env.VITE_STORAGE_DRIVER ?? "local";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const SUPABASE_TABLE = import.meta.env.VITE_SUPABASE_TABLE ?? "app_state";
const SUPABASE_SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA ?? "public";

function readLocalJson(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function createLocalStore() {
  return {
    mode: "local",
    async readJson(key, fallback) {
      return readLocalJson(key, fallback);
    },
    async writeJson(key, value) {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function buildSupabaseHeaders(extraHeaders = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Content-Profile": SUPABASE_SCHEMA,
    ...extraHeaders,
  };
}

function buildSupabaseUrl(searchParams) {
  const url = new URL(`/rest/v1/${SUPABASE_TABLE}`, SUPABASE_URL);
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

function createSupabaseStore() {
  return {
    mode: "supabase",
    async readJson(key, fallback) {
      const response = await fetch(
        buildSupabaseUrl({
          select: "payload",
          key: `eq.${key}`,
          limit: "1",
        }),
        {
          method: "GET",
          headers: buildSupabaseHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Supabase read failed with status ${response.status}`);
      }

      const rows = await response.json();
      return rows[0]?.payload ?? fallback;
    },
    async writeJson(key, value) {
      const response = await fetch(buildSupabaseUrl({}), {
        method: "POST",
        headers: buildSupabaseHeaders({
          Prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body: JSON.stringify([
          {
            key,
            payload: value,
          },
        ]),
      });

      if (!response.ok) {
        throw new Error(`Supabase write failed with status ${response.status}`);
      }
    },
  };
}

function createResilientStore(primaryStore, fallbackStore) {
  return {
    mode: primaryStore.mode,
    async readJson(key, fallback) {
      try {
        return await primaryStore.readJson(key, fallback);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Shared store read failed, falling back to local storage.", error);
        }

        return fallbackStore.readJson(key, fallback);
      }
    },
    async writeJson(key, value) {
      try {
        await primaryStore.writeJson(key, value);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Shared store write failed, falling back to local storage.", error);
        }

        await fallbackStore.writeJson(key, value);
      }
    },
  };
}

const localStore = createLocalStore();
const primaryStore =
  STORAGE_DRIVER === "supabase" && isSupabaseConfigured()
    ? createSupabaseStore()
    : localStore;

export const sharedStore = createResilientStore(primaryStore, localStore);

export function getStorageDriverSummary() {
  if (STORAGE_DRIVER === "supabase" && isSupabaseConfigured()) {
    return "Supabase";
  }

  return "Lokaler Browser-Speicher";
}
