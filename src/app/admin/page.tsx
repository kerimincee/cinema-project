"use client";

import "./admin.css";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";

type Screening = {
  movie_title: string;
  description: string;
  trailer_url: string;
  cover_image: string | null;
  screening_date: string;
  screening_time: string;
  total_capacity: number;
  active_reservations: number;
  remaining_capacity: number;
};

const emptyScreening: Screening = {
  movie_title: "",
  description: "",
  trailer_url: "",
  cover_image: null,
  screening_date: "",
  screening_time: "20:00",
  total_capacity: 50,
  active_reservations: 0,
  remaining_capacity: 50,
};

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [film, setFilm] = useState<Screening>(emptyScreening);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function initialize() {
      try {
        const authResponse = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!authResponse.ok) {
          throw new Error("Oturum kontrolü başarısız. Lütfen giriş yapın.");
        }

        const auth = await authResponse.json();

        if (auth.user?.role !== "admin") {
          throw new Error("Admin yetkisi doğrulanamadı. Bu sayfaya yalnızca yöneticiler erişebilir.");
        }

        setAuthorized(true);

        const response = await fetch("/api/screening", {
          cache: "no-store",
        });

        if (response.status === 404) {
          // Henüz film yok. Admin paneli boş formla açılabilir.
          setFilm(emptyScreening);
          setPreview("");
        } else if (!response.ok) {
          throw new Error("Film bilgileri alınamadı.");
        } else {
          const result = await response.json();
          const data = result.screening ?? result;

          if (data && data.movie_title) {
            setFilm({
              movie_title: data.movie_title ?? "",
              description: data.description ?? "",
              trailer_url: data.trailer_url ?? "",
              cover_image: data.cover_image ?? null,
              screening_date: (data.screening_date ?? "").slice(0, 10),
              screening_time: (data.screening_time ?? "20:00").slice(0, 5),
              total_capacity: Number(data.total_capacity ?? 50),
              active_reservations: Number(data.active_reservations ?? 0),
              remaining_capacity: Number(data.remaining_capacity ?? 50),
            });

            setPreview(data.cover_image ?? "");
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    }

    void initialize();
  }, []);

  function updateField(field: keyof Screening, value: string | number) {
    setFilm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function handleCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Lütfen geçerli bir görsel dosyası seçin.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Afiş görseli en fazla 5 MB olabilir.");
      return;
    }

    setCoverFile(file);
    setPreview(URL.createObjectURL(file));
    setError("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!film.movie_title.trim()) {
        throw new Error("Lütfen film adını girin.");
      }
      if (!film.description.trim()) {
        throw new Error("Lütfen film açıklamasını girin.");
      }
      if (!film.trailer_url.trim()) {
        throw new Error("Lütfen fragman bağlantısını girin.");
      }
      if (!film.screening_date) {
        throw new Error("Lütfen gösterim tarihini seçin.");
      }
      if (!film.screening_time) {
        throw new Error("Lütfen gösterim saatini seçin.");
      }

      // Eğer sistemde daha önceden yüklenmiş afiş yoksa yeni dosya zorunludur
      if (!film.cover_image && !coverFile) {
        throw new Error("İlk filmi eklemek için lütfen bir film afişi seçin.");
      }

      if (film.total_capacity < film.active_reservations) {
        throw new Error(
          `Toplam kapasite (${film.total_capacity}), mevcut aktif rezervasyon sayısından (${film.active_reservations}) daha az olamaz.`
        );
      }

      const formData = new FormData();
      formData.append("movie_title", film.movie_title.trim());
      formData.append("description", film.description.trim());
      formData.append("trailer_url", film.trailer_url.trim());
      formData.append("screening_date", film.screening_date);
      formData.append("screening_time", film.screening_time);
      formData.append("total_capacity", String(film.total_capacity));

      if (coverFile) {
        formData.append("cover_image", coverFile);
      }

      const response = await fetch("/api/admin/screening", {
        method: "PATCH",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Kaydetme işlemi başarısız.");
      }

      // Güncel verileri çek
      const refreshed = await fetch("/api/screening", {
        cache: "no-store",
      });

      if (refreshed.ok) {
        const refreshedResult = await refreshed.json();
        const data = refreshedResult.screening ?? refreshedResult;

        setFilm({
          movie_title: data.movie_title ?? "",
          description: data.description ?? "",
          trailer_url: data.trailer_url ?? "",
          cover_image: data.cover_image ?? null,
          screening_date: (data.screening_date ?? "").slice(0, 10),
          screening_time: (data.screening_time ?? "").slice(0, 5),
          total_capacity: Number(data.total_capacity ?? 0),
          active_reservations: Number(data.active_reservations ?? 0),
          remaining_capacity: Number(data.remaining_capacity ?? 0),
        });

        setPreview(data.cover_image ?? "");
      }

      setCoverFile(null);
      setMessage("Film ve gösterim bilgileri başarıyla kaydedildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="admin-loading">
        <p>Yönetim paneli yükleniyor...</p>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="cinema-admin">
        <div className="admin-container" style={{ textAlign: "center", paddingTop: "80px" }}>
          <div className="admin-card" style={{ maxWidth: "500px", margin: "0 auto", padding: "40px" }}>
            <h2 style={{ color: "#f87171", marginBottom: "16px" }}>🔒 Yetkisiz Erişim</h2>
            <p className="admin-muted" style={{ marginBottom: "24px" }}>
              {error || "Bu sayfaya yalnızca admin yetkisine sahip kullanıcılar erişebilir."}
            </p>
            <Link href="/" className="admin-back">
              ← Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="cinema-admin">
      <div className="admin-container">
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">SİNEMA YÖNETİM SİSTEMİ</p>
            <h1>Yönetim Paneli</h1>
            <p className="admin-muted">
              Film gösterimini, afişini ve salon kapasitesini yönetin.
            </p>
          </div>

          <Link href="/" className="admin-back">
            ← Siteye Dön
          </Link>
        </header>

        <section className="admin-stats">
          <div className="admin-stat">
            <span>Toplam Kapasite</span>
            <strong>{film.total_capacity}</strong>
            <small>kişilik salon</small>
          </div>

          <div className="admin-stat">
            <span>Aktif Rezervasyon</span>
            <strong>{film.active_reservations}</strong>
            <small>ayrılan yer</small>
          </div>

          <div className="admin-stat">
            <span>Kalan Kontenjan</span>
            <strong>{film.remaining_capacity}</strong>
            <small>müsait yer</small>
          </div>
        </section>

        <div className="admin-content">
          <section className="admin-card">
            <div className="admin-section-title">
              <h2>Film Bilgilerini Düzenle</h2>
              <p>Değişiklikleri kaydettiğinizde gösterim canlı olarak güncellenir.</p>
            </div>

            <form onSubmit={handleSave} className="admin-form">
              <label>
                Film Adı
                <input
                  required
                  value={film.movie_title}
                  onChange={(e) => updateField("movie_title", e.target.value)}
                  placeholder="Örn: Interstellar, Inception"
                />
              </label>

              <label>
                Film Açıklaması
                <textarea
                  required
                  rows={5}
                  value={film.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Filmin konusunu yazın..."
                />
              </label>

              <label>
                Fragman Bağlantısı (YouTube)
                <input
                  required
                  type="url"
                  value={film.trailer_url}
                  onChange={(e) => updateField("trailer_url", e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </label>

              <label>
                Film Kapak Görseli (Afiş)
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCover}
                />
                <small style={{ color: "#94a3b8", fontWeight: "normal", marginTop: "4px" }}>
                  {film.cover_image
                    ? "Mevcut afiş kayıtlı. Değiştirmek istemiyorsanız boş bırakabilirsiniz."
                    : "Lütfen bir afiş görseli seçin (Maks. 5 MB)."}
                </small>
              </label>

              <div className="admin-form-row">
                <label>
                  Gösterim Tarihi
                  <input
                    required
                    type="date"
                    value={film.screening_date}
                    onChange={(e) => updateField("screening_date", e.target.value)}
                  />
                </label>

                <label>
                  Gösterim Saati
                  <input
                    required
                    type="time"
                    value={film.screening_time}
                    onChange={(e) => updateField("screening_time", e.target.value)}
                  />
                </label>
              </div>

              <label>
                Toplam Kontenjan
                <input
                  required
                  type="number"
                  min={Math.max(1, film.active_reservations)}
                  value={film.total_capacity}
                  onChange={(e) =>
                    updateField("total_capacity", Number(e.target.value))
                  }
                />
                <small style={{ color: "#94a3b8", fontWeight: "normal" }}>
                  Mevcut aktif rezervasyon ({film.active_reservations}) sayısının altına düşürülemez.
                </small>
              </label>

              {message && (
                <div className="admin-success" role="status">
                  ✓ {message}
                </div>
              )}

              {error && (
                <div className="admin-error" role="alert">
                  ⚠ {error}
                </div>
              )}

              <button
                type="submit"
                className="admin-save"
                disabled={saving}
              >
                {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
              </button>
            </form>
          </section>

          <aside className="admin-card admin-preview">
            <h2>Canlı Film Önizlemesi</h2>
            <p className="admin-muted">
              Sitede gösterilecek film kartı
            </p>

            {preview ? (
              <img
                src={preview}
                alt="Film afişi"
                className="admin-poster"
              />
            ) : (
              <div className="admin-no-poster">
                Henüz afiş yüklenmedi
              </div>
            )}

            <h3>{film.movie_title || "Film adı"}</h3>
            <p className="admin-muted" style={{ marginTop: "8px", maxHeight: "120px", overflow: "hidden" }}>
              {film.description || "Film açıklaması burada görünecek..."}
            </p>

            <div className="admin-preview-details">
              <div>
                <span>Gösterim Tarihi</span>
                <strong style={{ display: "block", marginTop: "4px" }}>
                  {film.screening_date || "Belirlenmedi"}
                </strong>
              </div>
              <div>
                <span>Gösterim Saati</span>
                <strong style={{ display: "block", marginTop: "4px" }}>
                  {film.screening_time || "Belirlenmedi"}
                </strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
