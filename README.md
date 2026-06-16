# Urlaub App

Mobile-first Urlaubsplaner für eure Gruppe mit:

- Anreise
- Tagesplänen
- Wichtigen Informationen
- Einkaufsliste
- Packliste
- Essensplan
- Finanzen
- Allergien

## Aktueller Stand

Die App kann jetzt auf zwei Speicherarten vorbereitet betrieben werden:

1. `local`
   Alles bleibt wie bisher lokal im Browser des jeweiligen Geräts.
2. `supabase`
   Alle greifen auf denselben gemeinsamen Datenstand zu.

Die Umschaltung läuft über Umgebungsvariablen in [.env.example](/Users/isi/VS_Projects/urlaub-app/.env.example:1).

## Lokale Entwicklung

```bash
npm install
npm run dev
```

## Gemeinsame Nutzung Vorbereiten

### 1. Supabase-Projekt anlegen

Erstellt ein neues Supabase-Projekt.

### 2. Datenbank-Tabelle anlegen

Führt das SQL aus [supabase/schema.sql](/Users/isi/VS_Projects/urlaub-app/supabase/schema.sql:1) im SQL-Editor von Supabase aus.

Das legt eine einfache gemeinsame Schlüsselspeicher-Tabelle an:

- `key`
- `payload`
- `updated_at`

### 3. Umgebungsvariablen setzen

Legt eine `.env.local` im Projekt an:

```env
VITE_STORAGE_DRIVER=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_TABLE=app_state
VITE_SUPABASE_SCHEMA=public
```

Wenn `VITE_STORAGE_DRIVER=local` gesetzt ist oder die Supabase-Daten fehlen, nutzt die App automatisch weiter den Browser-Speicher.

### 4. Gemeinsamen Link deployen

Die App ist jetzt auch für klassisches SPA-Hosting vorbereitet:

- [vercel.json](/Users/isi/VS_Projects/urlaub-app/vercel.json:1)
- [netlify.toml](/Users/isi/VS_Projects/urlaub-app/netlify.toml:1)

Damit funktionieren direkte Aufrufe von Unterseiten wie `/daily-plans` oder `/finanzen` auch nach einem Reload.

#### Vercel

1. Repository mit Vercel verbinden
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Umgebungsvariablen aus `.env.local` in Vercel eintragen

#### Netlify

1. Repository mit Netlify verbinden
2. Build Command: `npm run build`
3. Publish Directory: `dist`
4. Umgebungsvariablen aus `.env.local` in Netlify eintragen

## Architektur

Die zentrale Daten-Schicht liegt jetzt hier:

- [src/lib/sharedStore.js](/Users/isi/VS_Projects/urlaub-app/src/lib/sharedStore.js:1)
- [src/lib/usePersistentState.js](/Users/isi/VS_Projects/urlaub-app/src/lib/usePersistentState.js:1)

Damit ist die App nicht mehr direkt an `localStorage` gebunden. Weitere Schritte wie echte Benutzerkonten, Rechte oder Live-Updates können darauf aufbauen.

Zusätzlich wartet die App jetzt beim Start auf die vollständige Daten-Hydrierung. Das verhindert, dass bei gemeinsamem Speicher erst leere Listen sichtbar sind und kurz danach die echten Inhalte nachladen.

## Was für echten Gruppenbetrieb noch sinnvoll ist

Für die reine gemeinsame Nutzung reicht der aktuelle Supabase-Ansatz grundsätzlich aus. Für einen sauberen Produktivbetrieb würde ich als Nächstes noch ergänzen:

1. echte Anmeldung statt lokaler Namensauswahl
2. RLS-Regeln pro Reise oder Gruppe statt komplett offenem Gruppen-Speicher
3. Live-Updates mit Realtime
4. Backup- und Exportfunktion
5. Deployment, z. B. über Vercel oder Netlify

## Wichtiger Hinweis

Die aktuelle Supabase-Vorbereitung ist bewusst einfach gehalten, damit ihr schnell gemeinsam starten könnt. Die SQL-Policies im Beispiel erlauben anonymes Lesen und Schreiben für diese App-Daten. Für eine private Familien- oder Freundesgruppe ist das als schneller Start okay, für eine allgemein zugängliche App sollte das später auf echte Authentifizierung umgestellt werden.
