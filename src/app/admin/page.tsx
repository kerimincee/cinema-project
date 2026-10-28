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

type AdminReservation = {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  user_phone: string;
  user_student_number: string;
  user_department: string;
  screening_id: number;
  movie_title: string;
  screening_date: string;
  screening_time: string;
  status: "active" | "cancelled";
  created_at: string;
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

  // Rezervasyon Yönetim State'leri
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "cancelled">("all");
  const [resActionMessage, setResActionMessage] = useState("");

  async function fetchReservations() {
    setLoadingReservations(true);
    try {
      const res = await fetch("/api/reservations?all=true", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setReservations(data.reservations || []);
      }
    } catch {
      // ignore error
    } finally {
      setLoadingReservations(false);
    }
  }

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

        // Film bilgilerini getir
        const response = await fetch("/api/screening", {
          cache: "no-store",
        });

        if (response.status === 404) {
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

        // Tüm rezervasyonları getir
        void fetchReservations();
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
      if (
        !film.movie_title.trim() ||
        !film.description.trim() ||
        !film.trailer_url.trim() ||
        !film.screening_date ||
        !film.screening_time
      ) {
        throw new Error("Lütfen tüm zorunlu alanları doldurun.");
      }

      if (film.total_capacity < 1) {
        throw new Error("Toplam kapasite en az 1 olmalıdır.");
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
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Kaydetme işlemi başarısız.");
      }

      setMessage("Film bilgileri ve afiş başarıyla güncellendi.");
      setCoverFile(null);

      const refreshResponse = await fetch("/api/screening", {
        cache: "no-store",
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const data = refreshData.screening ?? refreshData;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelReservation(reservationId: number, userName: string) {
    if (!confirm(`"${userName}" adlı öğrencinin rezervasyonunu iptal etmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/reservations?id=${reservationId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Rezervasyon iptal edilemedi.");
        return;
      }

      setResActionMessage(`Rezervasyon #${reservationId} başarıyla iptal edildi.`);
      setTimeout(() => setResActionMessage(""), 4000);

      // Rezervasyon listesini yenile
      await fetchReservations();

      // Film sayacını güncelle
      const filmRes = await fetch("/api/screening", { cache: "no-store" });
      if (filmRes.ok) {
        const filmData = await filmRes.json();
        const currentFilm = filmData.screening ?? filmData;
        setFilm((prev) => ({
          ...prev,
          active_reservations: Number(currentFilm.active_reservations ?? 0),
          remaining_capacity: Number(currentFilm.remaining_capacity ?? 0),
        }));
      }
    } catch {
      alert("Rezervasyon iptal edilirken bir hata oluştu.");
    }
  }

  function exportToCSV() {
    if (filteredReservations.length === 0) {
      alert("Dışa aktarılacak kayıt bulunmuyor.");
      return;
    }

    const headers = [
      "ID",
      "Öğrenci Adı Soyadı",
      "Öğrenci No",
      "Bölüm",
      "Telefon",
      "E-posta",
      "Film",
      "Gösterim Tarihi",
      "Durum",
      "Kayıt Tarihi",
    ];

    const rows = filteredReservations.map((r) => [
      r.id,
      `"${(r.user_name || "").replace(/"/g, '""')}"`,
      `"${(r.user_student_number || "").replace(/"/g, '""')}"`,
      `"${(r.user_department || "").replace(/"/g, '""')}"`,
      `"${(r.user_phone || "").replace(/"/g, '""')}"`,
      `"${(r.user_email || "").replace(/"/g, '""')}"`,
      `"${(r.movie_title || "").replace(/"/g, '""')}"`,
      `"${r.screening_date || ""} ${r.screening_time || ""}"`,
      r.status === "active" ? "Aktif" : "İptal Edildi",
      `"${(r.created_at || "").slice(0, 19)}"`,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((row) => row.join(";"))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `sinema_rezervasyon_listesi_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filtreleme ve arama mantığı
  const filteredReservations = reservations.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (r.user_name && r.user_name.toLowerCase().includes(q)) ||
      (r.user_email && r.user_email.toLowerCase().includes(q)) ||
      (r.user_phone && r.user_phone.toLowerCase().includes(q)) ||
      (r.user_student_number && r.user_student_number.toLowerCase().includes(q)) ||
      (r.user_department && r.user_department.toLowerCase().includes(q)) ||
      (r.movie_title && r.movie_title.toLowerCase().includes(q))
    );
  });

  const totalActiveResCount = reservations.filter((r) => r.status === "active").length;
  const totalCancelledResCount = reservations.filter((r) => r.status === "cancelled").length;

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
        <div className="admin-container">
          <header className="admin-header">
            <div>
              <p className="admin-eyebrow">YETKİSİZ ERİŞİM</p>
              <h1>Admin Paneline Giriş Yapılamadı</h1>
              <p className="admin-muted">{error}</p>
            </div>
            <Link href="/" className="admin-back">
              ← Siteye Dön
            </Link>
          </header>
        </div>
      </main>
    );
  }

  return (
    <main className="cinema-admin">
      <div className="admin-container">
        
        {/* Üst Başlık */}
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">SİNEMA YÖNETİM SİSTEMİ</p>
            <h1>Yönetim Paneli</h1>
            <p className="admin-muted">
              Film gösterimini, afişini, salon kapasitesini ve rezervasyonları yönetin.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <Link href="/" className="admin-back">
              ← Siteye Dön
            </Link>
          </div>
        </header>

        {/* İstatistik Kartları */}
        <section className="admin-stats">
          <div className="admin-stat">
            <span>Toplam Salon Kapasitesi</span>
            <strong>{film.total_capacity}</strong>
            <small>koltuk kontenjanı</small>
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

        {/* Film Düzenleme ve Canlı Önizleme */}
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

        {/* REZERVASYON LİSTESİ BÖLÜMÜ */}
        <section className="admin-card admin-reservations-card">
          <div className="admin-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
            <div>
              <h2>🎟️ Rezervasyon Listesi</h2>
              <p>Film gösterimine yer ayırtan öğrencilerin güncel listesi ve iletişim bilgileri.</p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                onClick={fetchReservations}
                disabled={loadingReservations}
                className="admin-btn-secondary"
                title="Listeyi sunucudan tekrar çek"
              >
                🔄 {loadingReservations ? "Yenileniyor..." : "Yenile"}
              </button>

              <button
                type="button"
                onClick={exportToCSV}
                className="admin-btn-secondary"
                title="Tablodaki kayıtları Excel / CSV formatında indir"
              >
                📥 Excel / CSV İndir
              </button>
            </div>
          </div>

          {resActionMessage && (
            <div className="admin-success" style={{ marginBottom: "16px" }} role="status">
              ✓ {resActionMessage}
            </div>
          )}

          {/* Filtre ve Arama Çubuğu */}
          <div className="admin-table-controls">
            <div className="admin-search-box">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Öğrenci adı, e-posta, tel no, öğrenci no veya bölüm ara..."
                className="admin-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px 8px" }}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="admin-filter-pills">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`admin-filter-pill ${statusFilter === "all" ? "active" : ""}`}
              >
                Tümü ({reservations.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`admin-filter-pill ${statusFilter === "active" ? "active" : ""}`}
              >
                Aktifler ({totalActiveResCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("cancelled")}
                className={`admin-filter-pill ${statusFilter === "cancelled" ? "active" : ""}`}
              >
                İptal Edilenler ({totalCancelledResCount})
              </button>
            </div>
          </div>

          {/* Tablo Alanı */}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}># ID</th>
                  <th>Öğrenci Adı Soyadı</th>
                  <th>Öğrenci No</th>
                  <th>Bölüm</th>
                  <th>Telefon</th>
                  <th>E-posta</th>
                  <th>Film / Seans</th>
                  <th>Kayıt Tarihi</th>
                  <th>Durum</th>
                  <th style={{ textAlign: "right" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="admin-table-empty">
                      {searchQuery || statusFilter !== "all"
                        ? "Arama kriterlerine uygun rezervasyon kaydı bulunamadı."
                        : "Henüz hiçbir rezervasyon yapılmamış."}
                    </td>
                  </tr>
                ) : (
                  filteredReservations.map((res) => (
                    <tr key={res.id}>
                      <td style={{ fontWeight: "bold", color: "#94a3b8" }}>
                        #{res.id}
                      </td>

                      <td style={{ fontWeight: "600", color: "#ffffff" }}>
                        {res.user_name || "İsimsiz Kullanıcı"}
                      </td>

                      <td>
                        {res.user_student_number ? (
                          <span className="badge-student-no">
                            {res.user_student_number}
                          </span>
                        ) : (
                          <span style={{ color: "#64748b" }}>-</span>
                        )}
                      </td>

                      <td style={{ color: "#cbd5e1" }}>
                        {res.user_department || <span style={{ color: "#64748b" }}>-</span>}
                      </td>

                      <td>
                        {res.user_phone ? (
                          <a
                            href={`tel:${res.user_phone}`}
                            style={{ color: "#60a5fa", textDecoration: "none" }}
                            title="Aramak için tıkla"
                          >
                            {res.user_phone}
                          </a>
                        ) : (
                          <span style={{ color: "#64748b" }}>-</span>
                        )}
                      </td>

                      <td style={{ color: "#94a3b8" }}>
                        <a
                          href={`mailto:${res.user_email}`}
                          style={{ color: "#94a3b8", textDecoration: "none" }}
                        >
                          {res.user_email}
                        </a>
                      </td>

                      <td>
                        <strong style={{ display: "block", color: "#f8fafc" }}>
                          {res.movie_title}
                        </strong>
                        <small style={{ color: "#94a3b8" }}>
                          {res.screening_date} • {res.screening_time?.slice(0, 5)}
                        </small>
                      </td>

                      <td style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {res.created_at ? res.created_at.slice(0, 16).replace("T", " ") : "-"}
                      </td>

                      <td>
                        {res.status === "active" ? (
                          <span className="badge-active">
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", display: "inline-block" }}></span>
                            Aktif
                          </span>
                        ) : (
                          <span className="badge-cancelled">
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f87171", display: "inline-block" }}></span>
                            İptal Edildi
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        {res.status === "active" ? (
                          <button
                            type="button"
                            onClick={() => handleCancelReservation(res.id, res.user_name)}
                            className="btn-cancel-reservation"
                            title="Rezervasyonu iptal et"
                          >
                            İptal Et
                          </button>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "12px" }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: "12px" }}>
            <span>Toplam {filteredReservations.length} kayıt listeleniyor</span>
            <span>Öğrenci kapı kontrolü için listeyi Excel/CSV olarak indirebilirsiniz.</span>
          </div>
        </section>

      </div>
    </main>
  );
}
