# Sinema Salonu Rezervasyon Projesi — Backend API Dokümantasyonu (`API.md`)

**Hazırlayan:** Hakan (Backend Sorumlusu)  
**Hedef Kitle:** Işılay (Frontend Sorumlusu) & Abdulbaki (Admin Paneli Sorumlusu)

Bu doküman, frontend ve admin paneli ekranlarının backend ile haberleşmesi için kullanılacak API adreslerini (endpoint), gönderilecek veri formatlarını (Request) ve dönecek cevapları (Response) açıklamaktadır.

> **Önemli Bilgi (Adres Formatı):**  
> Tüm API uç noktaları Next.js standartlarına uygun olarak `/api/...` altında çalışmaktadır (Örn: `/api/screening`). Aynı zamanda proje dokümanındaki örneklerle tam uyumluluk için `/api` öneki olmadan yapılan istekler de (Örn: `/screening`, `/auth/login`) otomatik olarak ilgili API'ye yönlendirilmektedir.

---

## 🔐 Kimlik Doğrulama (Authentication) Nasıl Çalışır?

Giriş (`POST /api/auth/login`) veya kayıt (`POST /api/auth/register`) işlemi başarılı olduğunda backend **3 yöntemi aynı anda** destekler:
1. **Otomatik Cookie (`auth_token`):** Tarayıcıda aynı proje içinde `fetch('/api/reservations', { method: 'POST' })` yaptığınızda çerez (cookie) otomatik gönderilir, ekstra bir ayar yapmanıza gerek kalmaz.
2. **Bearer Token:** Cevapta dönen `token` değerini `Authorization: Bearer <token>` başlığı (header) ile gönderebilirsiniz.
3. **Body / Query İçinde `user_id`:** İsterseniz giriş yapan kullanıcının `id` değerini istek gövdesinde (`{ "user_id": 1 }`) gönderebilirsiniz.

> **Güvenlik Notu:** Kullanıcının `admin` mi yoksa `user` mı olduğu her istekte backend tarafından doğrudan veritabanından kontrol edilir.

---

## 1. Kullanıcı Kayıt Olma

Yeni kullanıcı hesabı oluşturur. Parola veritabanına `bcrypt` ile özetlenerek (`password_hash`) kaydedilir ve varsayılan rol `user` olarak atanır.

- **Adres:** `POST /api/auth/register` *(veya `POST /auth/register`)*
- **Content-Type:** `application/json`

### Gönderilecek Bilgiler (Request Body)
```json
{
  "name": "Ahmet Yılmaz",
  "email": "ahmet@ornek.com",
  "password": "sifre123"
}
```

### Başarılı Cevap (`201 Created`)
```json
{
  "message": "Kayıt işlemi başarıyla tamamlandı.",
  "user": {
    "id": 1,
    "name": "Ahmet Yılmaz",
    "email": "ahmet@ornek.com",
    "role": "user",
    "is_admin": false
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Hata Cevapları
- `400 Bad Request`: Eksik alan veya 6 karakterden kısa parola (`{ "error": "Parola en az 6 karakter olmalıdır." }`)
- `409 Conflict`: E-posta zaten kayıtlı (`{ "error": "Bu e-posta adresi ile zaten bir hesap mevcut." }`)

---

## 2. Kullanıcı Giriş Yapma

Kullanıcı girişini doğrular ve kullanıcının normal kullanıcı (`user`) mı yoksa yönetici (`admin`) mi olduğunu döndürür.

- **Adres:** `POST /api/auth/login` *(veya `POST /auth/login`)*
- **Content-Type:** `application/json`

### Gönderilecek Bilgiler (Request Body)
```json
{
  "email": "ahmet@ornek.com",
  "password": "sifre123"
}
```

### Başarılı Cevap (`200 OK`)
```json
{
  "message": "Giriş başarılı.",
  "user": {
    "id": 1,
    "name": "Ahmet Yılmaz",
    "email": "ahmet@ornek.com",
    "role": "user",
    "is_admin": false
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
*(Not: Eğer giriş yapan kullanıcı admin ise `"role": "admin"` ve `"is_admin": true` döner.)*

### Hata Cevapları
- `400 Bad Request`: E-posta veya parola boş gönderildiğinde
- `401 Unauthorized`: E-posta veya parola hatalı olduğunda (`{ "error": "E-posta adresi veya parola hatalı." }`)

---

## 3. Oturum Kontrolü ve Çıkış (Yardımcı Uç Noktalar)

### Mevcut Kullanıcıyı Sorgulama
- **Adres:** `GET /api/auth/me`
- **Başarılı Cevap (`200 OK`):**
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "name": "Ahmet Yılmaz",
    "email": "ahmet@ornek.com",
    "role": "user",
    "is_admin": false
  }
}
```

### Çıkış Yapma
- **Adres:** `POST /api/auth/logout`
- **Başarılı Cevap (`200 OK`):** `{ "message": "Çıkış yapıldı." }`

---

## 4. Film ve Gösterim Bilgilerini Getirme

Aktif film gösteriminin tüm bilgilerini, `cover_image` (`BLOB` görsel verisini), toplam kapasitesini, aktif rezervasyon sayısını ve kalan kontenjanı getirir.

> **Görsel (`cover_image` — `BLOB / LONGBLOB`) Kullanımı:**  
> Veritabanında `BLOB` olarak saklanan film afişini frontend'de 2 şekilde gösterebilirsiniz:
> 1. `GET /api/screening` cevabındaki `cover_image` alanını doğrudan `<img src={data.cover_image} />` olarak kullanabilirsiniz (Base64 Data URI formatında döner).
> 2. Veya doğrudan `<img src="/api/screening/cover" />` adresini çağırabilirsiniz (binary BLOB akışı döner).

- **Adres:** `GET /api/screening` *(veya `GET /screening`)*

### Başarılı Cevap (`200 OK`)
```json
{
  "id": 1,
  "movie_title": "Inception",
  "description": "Bir hırsızın rüyalar üzerinden bilinçaltına sızma hikayesi.",
  "trailer_url": "https://www.youtube.com/watch?v=YoHD9XEInc0",
  "cover_image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
  "screening_date": "2026-10-25",
  "screening_time": "20:30:00",
  "total_capacity": 50,
  "active_reservations": 12,
  "remaining_capacity": 38,
  "is_full": false,
  "has_reserved": false,
  "screening": {
    "id": 1,
    "movie_title": "Inception",
    "description": "Bir hırsızın rüyalar üzerinden bilinçaltına sızma hikayesi.",
    "trailer_url": "https://www.youtube.com/watch?v=YoHD9XEInc0",
    "cover_image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
    "screening_date": "2026-10-25",
    "screening_time": "20:30:00",
    "total_capacity": 50,
    "active_reservations": 12,
    "remaining_capacity": 38,
    "is_full": false,
    "has_reserved": false
  }
}
```

### Alan Açıklamaları
| Alan | Tür | Açıklama |
| :--- | :--- | :--- |
| `cover_image` | `string` | Veritabanındaki `BLOB` görsel verisinin `<img src={...} />` içinde kullanıma hazır Base64 hali |
| `total_capacity` | `number` | Salonun toplam kapasitesi |
| `active_reservations` | `number` | Şu ana kadar yapılan aktif rezervasyon sayısı |
| `remaining_capacity` | `number` | Kalan boş kontenjan (`total_capacity - active_reservations`) |
| `is_full` | `boolean` | Kontenjan tamamen dolduysa `true`, yer varsa `false` |
| `has_reserved` | `boolean` | Giriş yapan kullanıcının bu gösterime zaten aktif rezervasyonu varsa `true` |

---

## 5. Yer Ayırtma (Rezervasyon Oluşturma)

Giriş yapmış kullanıcının aktif gösterim için 1 kişilik yer ayırtmasını sağlar.
- Koltuk seçimi yoktur.
- Her başarılı işlem kalan kontenjanı 1 düşürür.
- Aynı anda birden fazla kişi son yeri ayırtmaya çalışırsa veritabanı kilitlemesi (`FOR UPDATE`) sayesinde kapasite asla aşılmaz.
- Aynı kullanıcının aynı gösterime ikinci kez rezervasyon yapması engellenir.

- **Adres:** `POST /api/reservations` *(veya `POST /reservations`)*
- **Content-Type:** `application/json`

### Gönderilecek Bilgiler (Request Body)
*(Giriş yapılmışsa boş `{}` bile gönderilebilir; otomatik olarak aktif gösterime ve giriş yapmış kullanıcıya rezervasyon yapar. İsteğe bağlı olarak `screening_id` ve `user_id` gönderilebilir.)*
```json
{
  "screening_id": 1
}
```

### Başarılı Cevap (`201 Created`)
```json
{
  "message": "Rezervasyonunuz başarıyla oluşturuldu!",
  "reservation": {
    "id": 15,
    "user_id": 1,
    "screening_id": 1,
    "status": "active"
  },
  "total_capacity": 50,
  "active_reservations": 13,
  "remaining_capacity": 37,
  "is_full": false
}
```

### Hata Cevapları
- `401 Unauthorized`: Kullanıcı giriş yapmamışsa (`{ "error": "Yer ayırtmak için lütfen önce giriş yapın." }`)
- `409 Conflict`: Kullanıcının zaten aktif rezervasyonu varsa (`{ "error": "Bu gösterim için zaten aktif bir rezervasyonunuz bulunmaktadır." }`)
- `400 Bad Request`: Kontenjan dolmuşsa (`{ "error": "Salon kontenjanı dolmuştur. Yeni rezervasyon yapılamamaktadır.", "is_full": true, "remaining_capacity": 0 }`)

---

## 6. Admin Paneli — Film ve Gösterim Bilgilerini Güncelleme / Kaydetme (`BLOB` Destekli)

Sadece **`admin`** rolüne sahip kullanıcılar bu adresi kullanabilir. Normal kullanıcılar (`user`) istek gönderirse `403 Forbidden` hatası döner.
- Veritabanında henüz bir gösterim yoksa yeni gösterim oluşturur, varsa mevcut gösterimi günceller.
- **Kapasite Kuralı:** Admin, mevcut aktif rezervasyon sayısından daha düşük bir `total_capacity` belirleyemez.
- **Görsel (`cover_image` — `BLOB / LONGBLOB`):** Görsel veritabanında doğrudan `BLOB` olarak saklanır. Hem `multipart/form-data` (dosya yükleme) hem de JSON içinde Base64 kodlu binary veri olarak gönderilebilir.

- **Adres:** `PATCH /api/admin/screening` *(Ayrıca `POST` ve `PUT` metotlarını ve `/admin/screening` adresini de destekler)*

### Yöntem 1 (Önerilen): `FormData` (`multipart/form-data`) ile Dosya Yükleme
Admin panelinde `<input type="file" name="cover_image" accept="image/*" />` kullanılarak doğrudan görsel dosyası gönderilebilir:
```js
const formData = new FormData();
formData.append("movie_title", "Interstellar");
formData.append("description", "İnsanlığın yeni bir yaşam alanı arayışını konu alan bilim kurgu filmi.");
formData.append("trailer_url", "https://www.youtube.com/watch?v=zSWdZVtXT7E");
formData.append("cover_image", fileInput.files[0]); // BLOB olarak veritabanına kaydedilir
formData.append("screening_date", "2026-11-01");
formData.append("screening_time", "21:00");
formData.append("total_capacity", "60");

await fetch("/api/admin/screening", {
  method: "PATCH",
  body: formData,
});
```

### Yöntem 2: JSON İle Base64 Binary Veri Gönderimi (`application/json`)
```json
{
  "movie_title": "Interstellar",
  "description": "İnsanlığın yeni bir yaşam alanı arayışını konu alan bilim kurgu filmi.",
  "trailer_url": "https://www.youtube.com/watch?v=zSWdZVtXT7E",
  "cover_image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
  "screening_date": "2026-11-01",
  "screening_time": "21:00",
  "total_capacity": 60
}
```

### Başarılı Cevap (`200 OK` / `201 Created`)
```json
{
  "message": "Film ve gösterim bilgileri başarıyla güncellendi.",
  "id": 1,
  "movie_title": "Interstellar",
  "description": "İnsanlığın yeni bir yaşam alanı arayışını konu alan bilim kurgu filmi.",
  "trailer_url": "https://www.youtube.com/watch?v=zSWdZVtXT7E",
  "cover_image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
  "screening_date": "2026-11-01",
  "screening_time": "21:00:00",
  "total_capacity": 60,
  "active_reservations": 13,
  "remaining_capacity": 47,
  "is_full": false
}
```

### Hata Cevapları
- `401 Unauthorized`: Giriş yapılmamışsa
- `403 Forbidden`: Giriş yapan kullanıcı `admin` değilse (`{ "error": "Bu işlemi gerçekleştirmek için admin yetkisine sahip olmalısınız." }`)
- `400 Bad Request`: Yeni toplam kontenjan mevcut aktif rezervasyon sayısından düşükse (`{ "error": "Toplam kontenjan (10), mevcut aktif rezervasyon sayısından (13) daha düşük olamaz." }`)
