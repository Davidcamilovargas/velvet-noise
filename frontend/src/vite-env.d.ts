/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WOMPI_PUBLIC_KEY: string;
  readonly VITE_WHATSAPP_NUMBER?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_HERO_VIDEO_URL?: string;
  readonly VITE_HERO_POSTER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
