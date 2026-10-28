"use client";

import React, { useState, useEffect, Suspense, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type ScreeningPreview = {
  id?: number;
  movie_title: string;
  description: string;
  cover_image?: string;
  screening_date: string;
  screening_time: string;
  remaining_capacity: number;
  total_capacity: number;
};

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [screening, setScreening] = useState<ScreeningPreview | null>(null);

  // Form alanları
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode === "register" || urlMode === "login") {
      setMode(urlMode);
    }
  }, [searchParams]);

  // Güncel film ve kapak fotoğrafı bilgisini çek
  useEffect(() => {
    async function loadScreening() {
      try {
        const res = await fetch("/api/screening", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const film = data.screening ?? data;
          setScreening(film);
        }
      } catch {
        // Film bilgisi alınamazsa sessizce devam et
      }
    }
    void loadScreening();
  }, []);

  // Sayfa açıldığında zaten oturum açık mı kontrol et
  useEffect(() => {
    async function checkExistingAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            router.push("/");
          }
        }
      } catch {
        // Oturum yok, formda kal
      }
    }
    void checkExistingAuth();
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setErrorMessage(data.error || "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
          setLoading(false);
          return;
        }

        setSuccessMessage("Giriş başarılı! Yönlendiriliyorsunuz...");
        setTimeout(() => {
          const redirect = searchParams.get("redirect") || "/";
          router.push(redirect);
          router.refresh();
        }, 600);
      } else {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            phone,
            student_number: studentNumber,
            department,
            password,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setErrorMessage(data.error || "Kayıt işlemi gerçekleştirilemedi.");
          setLoading(false);
          return;
        }

        setSuccessMessage("Kayıt başarılı! Giriş yapılıyor...");
        setTimeout(() => {
          const redirect = searchParams.get("redirect") || "/";
          router.push(redirect);
          router.refresh();
        }, 700);
      }
    } catch {
      setErrorMessage("Sunucuya bağlanırken bir hata oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07080b] text-white flex flex-col justify-between selection:bg-orange-500/30">
      {/* Üst Navigasyon Barı */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 group text-white/70 hover:text-white transition text-sm"
        >
          <span className="text-orange-400 group-hover:-translate-x-1 transition-transform">←</span>
          <span>Ana Sayfaya Dön</span>
        </Link>
        <Link href="/" className="text-xl font-black tracking-tight">
          perde<span className="text-orange-400">.</span>
        </Link>
      </header>

      {/* Ana Gövde (2 Kolonlu Düzen) */}
      <main className="w-full max-w-6xl mx-auto px-6 py-4 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Sol Kolon: Giriş / Kayıt Formu */}
          <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center py-4">
            
            {/* Logo İkonu */}
            <div className="mb-6 flex items-center gap-3">
              <div className="relative w-8 h-8 flex items-center justify-center">
                <span className="absolute top-0 left-0 w-4 h-4 bg-white rounded-[3px] shadow-sm"></span>
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-white/90 rounded-[3px] shadow-sm"></span>
              </div>
              <span className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
                KAMPÜS SİNEMASI
              </span>
            </div>

            {/* Başlık ve Açıklama (Tamamen Türkçe) */}
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">
              {mode === "login" ? "Tekrar Hoş Geldiniz!" : "Hesap Oluşturun"}
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              {mode === "login"
                ? "Kampüs sinema gösterimleri için yerinizi ayırtın ve haftalık film seanslarını kaçırmayın."
                : "Hızlıca kaydolun; yerinizi saniyeler içinde ayırtın ve etkinliklerden haberdar olun."}
            </p>

            {/* Bildirim Mesajları */}
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 p-3.5 text-sm text-red-300">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-sm text-emerald-300">
                {successMessage}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Kayıt Alanları (Sadece Kayıt modunda) */}
              {mode === "register" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      İsim Soyisim
                    </label>
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Adınız ve Soyadınız"
                      className="w-full rounded-xl bg-[#14151b] border border-[#272935] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Telefon Numarası
                      </label>
                      <input
                        required
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="05XX XXX XX XX"
                        className="w-full rounded-xl bg-[#14151b] border border-[#272935] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Öğrenci Numarası
                      </label>
                      <input
                        required
                        type="text"
                        value={studentNumber}
                        onChange={(e) => setStudentNumber(e.target.value)}
                        placeholder="Örn: 2024010203"
                        className="w-full rounded-xl bg-[#14151b] border border-[#272935] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Bölüm
                    </label>
                    <input
                      required
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Örn: Bilgisayar Mühendisliği"
                      className="w-full rounded-xl bg-[#14151b] border border-[#272935] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition"
                    />
                  </div>
                </>
              )}

              {/* Ortak Alanlar: E-posta ve Şifre (Türkçe Etiketler) */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  E-posta Adresi
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@posta.com"
                  className="w-full rounded-xl bg-[#14151b] border border-[#272935] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Şifre
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "En az 6 karakterli şifre" : "Şifrenizi girin"}
                  className="w-full rounded-xl bg-[#14151b] border border-[#272935] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition"
                />
              </div>

              {/* Giriş Yap / Kayıt Ol Butonu */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 rounded-xl bg-[#242630] hover:bg-[#2e313d] text-white font-medium py-3.5 px-4 border border-[#373948] transition-all shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2 text-sm text-zinc-300">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    İşlem yapılıyor...
                  </span>
                ) : mode === "login" ? (
                  "Giriş Yap"
                ) : (
                  "Kayıt Ol"
                )}
              </button>
            </form>

            {/* Alt Geçiş Linki (Türkçe) */}
            <div className="mt-6 text-center text-xs text-zinc-400">
              {mode === "login" ? (
                <>
                  Hesabınız yok mu?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className="text-orange-400 hover:text-orange-300 font-medium transition ml-1 cursor-pointer"
                  >
                    Kayıt Ol
                  </button>
                </>
              ) : (
                <>
                  Zaten bir hesabınız var mı?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className="text-orange-400 hover:text-orange-300 font-medium transition ml-1 cursor-pointer"
                  >
                    Giriş Yap
                  </button>
                </>
              )}
            </div>

          </div>

          {/* Sağ Kolon: Güncel Film Kapak Fotoğrafı ile Sinematik Görsel Kart */}
          <div className="lg:col-span-6 xl:col-span-7 hidden lg:block pl-6">
            <div className="relative rounded-[28px] overflow-hidden border border-white/10 bg-[#101116] shadow-2xl min-h-[580px] flex flex-col justify-between p-8 sm:p-10 group">
              
              {/* Güncel Film Kapak Fotoğrafı (Varsa) */}
              {screening?.cover_image ? (
                <>
                  <img
                    src={screening.cover_image}
                    alt={screening.movie_title || "Film Afişi"}
                    className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.75] contrast-[1.05] transition-all duration-700 group-hover:scale-105"
                  />
                  {/* Sinematik Koyu Gradyan Katmanları */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07080b] via-[#07080b]/55 to-[#07080b]/40 pointer-events-none"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#07080b]/70 via-transparent to-black/30 pointer-events-none"></div>
                </>
              ) : (
                <>
                  {/* Kapak fotoğrafı yoksa şık varsayılan koyu degrade zemin */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#12141c] via-[#0d0e14] to-[#1a1208] pointer-events-none"></div>
                  <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-gradient-to-t from-orange-600/30 via-amber-700/20 to-transparent blur-3xl pointer-events-none"></div>
                </>
              )}

              {/* Üst Rozet ve Başlık */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse"></span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                    Haftanın Gösterimi
                  </span>
                </div>
                <div className="text-xs text-white/80 font-bold tracking-tight bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                  perde<span className="text-orange-400">.</span>
                </div>
              </div>

              {/* Orta Kısım: Güncel Film Bilgisi */}
              <div className="relative z-10 my-auto py-6">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-400 drop-shadow mb-2">
                  Vizyonda
                </p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-lg leading-tight">
                  {screening?.movie_title || "Film Bilgisi Yükleniyor..."}
                </h2>
                {screening?.screening_date && (
                  <div className="mt-3 inline-flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-200 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg">
                    <span>📅 {screening.screening_date}</span>
                    <span>•</span>
                    <span>⏰ {screening.screening_time?.slice(0, 5)}</span>
                    {screening.remaining_capacity !== undefined && (
                      <>
                        <span>•</span>
                        <span className="text-orange-300 font-medium">
                          🎟️ {screening.remaining_capacity} koltuk kaldı
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Alt Bilgi ve Yorum Kutusu */}
              <div className="relative z-10">
                
                {/* Etiket Rozetleri */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 rounded-md text-[11px] font-medium bg-black/70 border border-white/15 text-zinc-200 backdrop-blur-md shadow-sm">
                    🎬 Kampüs Sineması
                  </span>
                  <span className="px-3 py-1 rounded-md text-[11px] font-medium bg-black/70 border border-white/15 text-zinc-200 backdrop-blur-md shadow-sm">
                    🍿 Koltuk Rezervasyonu
                  </span>
                </div>

                {/* Yarı Saydam Cam Alıntı Kartı */}
                <div className="rounded-2xl bg-black/75 backdrop-blur-md border border-white/15 p-5 shadow-2xl">
                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-normal line-clamp-2">
                    {screening?.description
                      ? `"${screening.description}"`
                      : '"Haftanın seçkin filmlerini sinema salonumuzda izlemek için yerinizi saniyeler içinde ayırtın. Artık kapıda sıra bekleme veya yer bulamama derdi yok."'}
                  </p>
                  
                  <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white">
                        Sinema Kulübü Koordinatörlüğü
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Öğrenci Dekanlığı & Kültür-Sanat Topluluğu
                      </p>
                    </div>
                    <span className="text-xs font-medium text-orange-400 bg-orange-500/15 px-2.5 py-1 rounded-full border border-orange-500/30">
                      Ücretsiz Seanslar
                    </span>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Sade Alt Bilgi */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 text-center text-xs text-zinc-500">
        © 2026 Kampüs Sinema Rezervasyon Sistemi. Tüm hakları saklıdır.
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07080b] text-white flex items-center justify-center">
        <div className="text-sm text-zinc-400">Sayfa yükleniyor...</div>
      </div>
    }>
      <AuthForm />
    </Suspense>
  );
}
