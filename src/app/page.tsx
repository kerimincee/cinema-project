"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Screening = {
  id: number;
  movie_title: string;
  description: string;
  trailer_url: string;
  cover_image?: string;
  screening_date: string;
  screening_time: string;
  total_capacity: number;
  active_reservations?: number;
  remaining_capacity: number;
  is_full: boolean;
  has_reserved: boolean;
};

type ScreeningResponse = Screening & {
  screening?: Screening;
};

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  student_number?: string;
  department?: string;
  role: string;
};

export default function Home() {
  const [screening, setScreening] = useState<Screening | null>(null);
  const [reserved, setReserved] = useState(false);
  const [apiMessage, setApiMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const youtubeId =
    screening?.trailer_url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/
    )?.[1] ?? "";

  const trailerEmbedUrl = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}?rel=0&playsinline=1`
    : "";

  const backgroundTrailerUrl = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&start=60&loop=1&playlist=${youtubeId}&playsinline=1&rel=0`
    : "";

  useEffect(() => {
    async function loadScreening() {
      try {
        const response = await fetch("/api/screening");

        if (!response.ok) {
          throw new Error("Film bilgileri alınamadı.");
        }

        const data = (await response.json()) as ScreeningResponse;
        const film = data.screening ?? data;

        setScreening(film);
        setReserved(film.has_reserved);
      } catch {
        setApiMessage("Film bilgileri yüklenemedi.");
      }
    }

    void loadScreening();
  }, []);

  useEffect(() => {
    async function checkLogin() {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = await response.json();
          setIsLoggedIn(true);
          setIsAdmin(data.user?.role === "admin");
          setCurrentUser(data.user ?? null);
        } else {
          setIsLoggedIn(false);
          setIsAdmin(false);
          setCurrentUser(null);
        }
      } catch {
        setIsLoggedIn(false);
        setIsAdmin(false);
        setCurrentUser(null);
      }
    }

    void checkLogin();
  }, []);

  const isFull =
    screening?.is_full ||
    (screening?.remaining_capacity !== undefined &&
      screening.remaining_capacity <= 0);
  const isButtonDisabled = !reserved && isFull;

  return (
    <main className="min-h-screen bg-[#090b12] text-white">
      {/* Üst bölüm: arka planda fragman */}
      <section className="relative flex min-h-[90vh] items-end overflow-hidden">
        {backgroundTrailerUrl && (
          <iframe
            className="absolute left-1/2 top-1/2 h-[100vh] w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 scale-110 opacity-40"
            src={backgroundTrailerUrl}
            title="Film fragmanı — arka plan"
            allow="autoplay; encrypted-media; picture-in-picture"
            tabIndex={-1}
            aria-hidden="true"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-[#090b12] via-[#090b12]/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090b12] via-transparent to-black/30" />

        <header className="absolute left-0 right-0 top-0 z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Link href="/" className="text-2xl font-black tracking-tight">
            perde<span className="text-orange-400">.</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-white/75 sm:flex">
            <a href="#film" className="transition hover:text-white">
              Film
            </a>
            <a href="#gosterim" className="transition hover:text-white">
              Gösterim bilgisi
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-full bg-orange-400 px-4 py-2 text-xs font-bold text-black shadow-lg transition hover:bg-orange-300"
              >
                ⚙️ Yönetim Paneli
              </Link>
            )}

            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                {currentUser?.name && (
                  <span className="text-xs text-white/80 hidden sm:inline-block bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                    👤 {currentUser.name}
                  </span>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    setIsLoggedIn(false);
                    setIsAdmin(false);
                    setCurrentUser(null);
                    window.location.reload();
                  }}
                  className="rounded-full border border-white/25 px-5 py-2 text-sm transition hover:bg-white hover:text-black cursor-pointer"
                >
                  Çıkış yap
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-full border border-white/25 px-5 py-2 text-sm transition hover:bg-white hover:text-black"
              >
                Giriş yap / Kayıt ol
              </Link>
            )}
          </div>
        </header>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-20 pt-32">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
            Haftanın Gösterimi
          </p>

          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
            {screening?.movie_title ?? "Film bilgisi yükleniyor..."}
          </h1>

          <p className="mt-5 max-w-2xl leading-7 text-white/65">
            {screening?.description ?? apiMessage}
          </p>

          <button
            onClick={() =>
              document
                .getElementById("fragman")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="mt-8 rounded-full border border-white/30 px-6 py-3 text-sm font-medium transition hover:border-white hover:bg-white hover:text-black"
          >
            Detaylar ve rezervasyon ↓
          </button>
        </div>

        <div className="absolute bottom-6 right-8 hidden text-xs uppercase tracking-[0.25em] text-white/45 md:block">
          Aşağı kaydır
          <span className="ml-3 text-orange-300">↓</span>
        </div>
      </section>

      {/* Alt bölüm: fragman, salon ve film detayları */}
      <section
        id="film"
        className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1.25fr_0.75fr]"
      >
        <div>
          <div id="fragman" />

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/40">
            {trailerEmbedUrl ? (
              <iframe
                className="aspect-video w-full"
                src={trailerEmbedUrl}
                title="Film fragmanı"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <p className="p-6 text-white/70">Fragman yükleniyor...</p>
            )}
          </div>

          <p className="mt-3 text-sm text-white/45">
            Fragman bu sayfanın içinde oynatılır.
          </p>
        </div>

        <aside id="gosterim" className="flex flex-col">
          {screening?.cover_image && (
            <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
              <img
                src={screening.cover_image}
                alt={screening.movie_title || "Film Afişi"}
                className="max-h-80 w-full object-cover"
              />
            </div>
          )}

          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-orange-300">
            Gösterim yeri
          </p>

          <h2 className="text-2xl font-semibold sm:text-3xl">
            Atatürk Üniversitesi
            <br />
            Sinema Salonu
          </h2>

          <div className="my-6 h-px bg-white/15" />

          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-orange-300">
            Film hakkında
          </p>

          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-white/45">Tarih ve saat</dt>
              <dd className="mt-1 text-base font-medium">
                {screening?.screening_date ?? "-"} •{" "}
                {screening?.screening_time?.slice(0, 5) ?? "-"}
              </dd>
            </div>

            <div>
              <dt className="text-white/45">Kalan kontenjan</dt>
              <dd className="mt-1 text-base font-medium">
                {screening?.remaining_capacity ?? "-"} /{" "}
                {screening?.total_capacity ?? "-"} koltuk
              </dd>
            </div>
          </dl>

          <button
            disabled={isButtonDisabled}
            onClick={async () => {
              if (!isLoggedIn) {
                window.location.href = "/login?redirect=/";
                return;
              }

              if (!screening) return;

              const cancelling = reserved;
              setApiMessage("");

              try {
                const response = await fetch("/api/reservations", {
                  method: cancelling ? "DELETE" : "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ screening_id: screening.id }),
                });

                const result = await response.json();

                if (!response.ok) {
                  if (response.status === 401) {
                    window.location.href = "/login?redirect=/";
                    return;
                  }

                  setApiMessage(result.error ?? "İşlem yapılamadı.");
                  return;
                }

                if (cancelling) {
                  const refreshResponse = await fetch("/api/screening");

                  if (!refreshResponse.ok) {
                    throw new Error("Güncel gösterim bilgisi alınamadı.");
                  }

                  const refreshData =
                    (await refreshResponse.json()) as ScreeningResponse;
                  const film = refreshData.screening ?? refreshData;

                  setScreening(film);
                  setReserved(false);
                  setApiMessage(result.message ?? "Rezervasyon iptal edildi.");
                  return;
                }

                setReserved(true);
                setScreening((current) =>
                  current
                    ? {
                        ...current,
                        remaining_capacity:
                          result.remaining_capacity ??
                          current.remaining_capacity - 1,
                        active_reservations:
                          result.active_reservations ??
                          (current.active_reservations ?? 0) + 1,
                        is_full: result.is_full ?? false,
                        has_reserved: true,
                      }
                    : current
                );
                setApiMessage(result.message ?? "Yeriniz ayrıldı.");
              } catch {
                setApiMessage("İşlem sırasında sunucuya bağlanılamadı.");
              }
            }}
            className={`mt-6 w-full rounded-xl px-6 py-4 font-semibold transition ${
              reserved
                ? "bg-emerald-700 text-white hover:bg-emerald-600 cursor-pointer"
                : isButtonDisabled
                ? "cursor-not-allowed bg-zinc-700 text-zinc-400"
                : "bg-orange-400 text-black hover:bg-orange-300 cursor-pointer"
            }`}
          >
            {reserved
              ? "Rezervasyonu iptal et"
              : isButtonDisabled
              ? "Kontenjan Dolu"
              : "Yerimi ayırt"}
          </button>

          {apiMessage && (
            <p className="mt-3 text-center text-sm text-white/75">
              {apiMessage}
            </p>
          )}
        </aside>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/10 px-6 py-7 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 Perde Sinema Kulübü</span>
        <span>İyi film, güzel bir akşam.</span>
        <a href="#" className="hover:text-white">
          Yukarı dön ↑
        </a>
      </footer>
    </main>
  );
}
