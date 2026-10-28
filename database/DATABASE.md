# Sinema Rezervasyon Sistemi - Veritabanı Dokümantasyonu (DATABASE.md)

Bu doküman, projede kullanılan tabloları, sütun yapılarını ve veri türlerini açıklamaktadır. Backend ve frontend geliştirmeleri bu şemaya uygun olarak yapılmalıdır.

---

## 1. `users` Tablosu
Kullanıcı hesaplarını ve yetkilerini saklar.

| Sütun Adı | Veri Türü | Kısıtlamalar / Varsayılan | Açıklama |
| :--- | :--- | :--- | :--- |
| `id` | INT | Primary Key, Auto Increment | Benzersiz kullanıcı numarası |
| `name` | VARCHAR(100) | NOT NULL | Kullanıcının adı soyadı |
| `email` | VARCHAR(150) | UNIQUE, NOT NULL | Giriş için kullanılan e-posta |
| `phone` | VARCHAR(20) | NULL | Telefon numarası |
| `student_number` | VARCHAR(50) | NULL | Öğrenci numarası |
| `department` | VARCHAR(100) | NULL | Bölüm bilgisi |
| `password_hash` | VARCHAR(255) | NOT NULL | Güvenli özetlenmiş parola |
| `role` | VARCHAR(20) | DEFAULT 'user' | Kullanıcı rolü (`user` veya `admin`) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Kayıt tarihi |

---

## 2. `screenings` Tablosu
Film gösterimi, seans, fragman ve salon kapasite bilgilerini saklar.

| Sütun Adı | Veri Türü | Kısıtlamalar / Varsayılan | Açıklama |
| :--- | :--- | :--- | :--- |
| `id` | INT | Primary Key, Auto Increment | Benzersiz gösterim numarası |
| `movie_title` | VARCHAR(255) | NOT NULL | Filmin tam adı |
| `description` | TEXT | NOT NULL | Filmin konusu ve açıklaması |
| `trailer_url` | VARCHAR(255) | NOT NULL | YouTube / video fragman bağlantısı |
| `cover_image` | BLOB / LONGBLOB | NOT NULL | Film afişi / görsel verisi (Doğrudan veritabanında saklanır) |
| `screening_date` | DATE | NOT NULL | Gösterim günü (YYYY-AA-GG) |
| `screening_time` | TIME | NOT NULL | Gösterim saati (SS:DD) |
| `total_capacity` | INT | NOT NULL | Salonun toplam kontenjanı |

---

## 3. `reservations` Tablosu
Kullanıcıların yaptıkları rezervasyon kayıtlarını saklar.

| Sütun Adı | Veri Türü | Kısıtlamalar / Varsayılan | Açıklama |
| :--- | :--- | :--- | :--- |
| `id` | INT | Primary Key, Auto Increment | Benzersiz rezervasyon numarası |
| `user_id` | INT | Foreign Key (`users.id`) | Rezervasyonu yapan kullanıcı ID'si |
| `screening_id` | INT | Foreign Key (`screenings.id`) | Rezervasyon yapılan gösterim ID'si |
| `status` | VARCHAR(20) | DEFAULT 'active' | Durum (`active`, `cancelled`) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Rezervasyonun yapıldığı tarih ve saat |
