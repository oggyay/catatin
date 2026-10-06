# Struktur Aplikasi Mobile

> Kuadran: **Reference** — peta modul Android (Kotlin + Compose) di `mobile/`. Source: `mobile/app/src/main/java/com/example/catatin/**`.

> Status: implementasi mobile **masih awal**. Beberapa screen dan ViewModel sudah dibuat dengan struktur lengkap, namun coverage fitur belum sebanding dengan web. Treat dokumen ini sebagai panduan struktur, bukan referensi fitur lengkap.

## Stack teknologi

| Komponen | Library |
| --- | --- |
| UI | Jetpack Compose (Material 3) |
| Navigation | androidx Navigation 3 (`navigation3.runtime`, `navigation3.ui`) |
| HTTP client | Ktor client (OkHttp engine) + ContentNegotiation + JSON |
| DI | Koin (`koin-android`, `koin-compose`, `koin-compose-viewmodel`) |
| Serialization | kotlinx.serialization JSON |
| Datastore | `datastore.preferences` (token storage) |
| Image loading | Coil 3 |
| Datetime | `kotlinx.datetime` |

Konfigurasi build: `mobile/app/build.gradle.kts`.

## Konfigurasi penting

- `compileSdk = 36`, `minSdk = 26`, `targetSdk = 36`.
- `applicationId = "com.example.catatin"`.
- `BuildConfig.API_BASE_URL = "http://10.0.2.2:4000"` — alamat host dari emulator Android. Ganti untuk device fisik atau backend remote.
- `usesCleartextTraffic = true` (untuk dev). **Wajib `false` di production** — gunakan HTTPS.

## Struktur paket

```
com.example.catatin/
├── CatatinApp.kt          // Application class, init Koin
├── MainActivity.kt        // ComponentActivity, set Compose content
├── Navigation.kt          // Nav graph (top-level)
├── NavigationKeys.kt      // Konstanta route key
├── data/
│   ├── DataRepository.kt  // (placeholder, mungkin koordinator)
│   ├── api/
│   │   ├── ApiClient.kt           // Ktor HttpClient config
│   │   ├── TokenManager.kt        // DataStore-backed JWT storage
│   │   ├── AuthApiService.kt
│   │   ├── DashboardApiService.kt
│   │   ├── AccountApiService.kt
│   │   ├── CategoryApiService.kt
│   │   ├── TransactionApiService.kt
│   │   ├── ReportApiService.kt
│   │   └── SettingsApiService.kt
│   └── model/Models.kt    // data class semua DTO (mirror dari backend)
├── di/AppModule.kt        // Koin modules: ApiClient, services, viewmodels
├── theme/
│   ├── Color.kt
│   ├── Theme.kt
│   └── Type.kt
├── ui/
│   ├── components/CommonComponents.kt   // KPI card, list item, dll.
│   ├── main/
│   │   ├── MainScreen.kt          // shell (drawer/topbar)
│   │   └── MainScreenViewModel.kt
│   └── screens/
│       ├── auth/{Login,Register,VerifyOtp}Screen.kt + *ViewModel.kt + AuthViewModel.kt
│       ├── dashboard/DashboardScreen.kt + DashboardViewModel.kt
│       ├── transactions/{Transactions,NewTransaction}Screen.kt + TransactionsViewModel.kt
│       ├── accounts/AccountsScreen.kt + AccountsViewModel.kt
│       ├── categories/CategoriesScreen.kt + CategoriesViewModel.kt
│       ├── reports/CashflowReportScreen.kt + ReportsViewModel.kt
│       └── settings/{Profile,Users,Subscription,Whatsapp}Screen.kt + SettingsScreen.kt + SettingsViewModel.kt
└── util/FormatUtils.kt    // formatIDR / formatDate untuk Compose
```

## Alur autentikasi mobile

1. `LoginScreen` mengumpulkan nomor → `AuthApiService.requestOtp` → navigate ke `VerifyOtpScreen`.
2. `VerifyOtpScreen` panggil `verifyOtp` → simpan token via `TokenManager` (DataStore) → navigate ke `DashboardScreen`.
3. `ApiClient` (Ktor) memasang interceptor untuk menambahkan `Authorization: Bearer ${token}` ke setiap request.
4. Logout → `TokenManager` clear token → navigate ke `LoginScreen`.

Detail implementasi `TokenManager.kt` menggunakan `DataStore<Preferences>` dengan key string sederhana.

## Alur per layar (high-level)

| Screen | Endpoint backend yang dipanggil |
| --- | --- |
| `LoginScreen` | `POST /auth/request-otp` |
| `VerifyOtpScreen` | `POST /auth/verify-otp` |
| `RegisterScreen` | `POST /auth/register`, lalu `verify-otp` |
| `DashboardScreen` | `GET /dashboard/summary`, `/dashboard/recent-transactions` |
| `TransactionsScreen` | `GET /transactions` (paginasi terbatas) |
| `NewTransactionScreen` | `POST /transactions` |
| `AccountsScreen` | `GET/POST/PATCH /accounts` |
| `CategoriesScreen` | `GET/POST/PATCH /categories` |
| `CashflowReportScreen` | `GET /reports/cashflow` |
| `SettingsProfileScreen` | `GET/PATCH /settings/profile` |
| `SettingsSubscriptionScreen` | `GET /settings/subscription` |
| `SettingsUsersScreen` | `GET/POST/PATCH /settings/users` |
| `SettingsWhatsappScreen` | `GET /settings/whatsapp` + link-token / link-request |

## Pola ViewModel

Setiap screen punya pasangan ViewModel yang:
- Hold UI state via `StateFlow<UiState>` (data class dengan `loading`, `data`, `error`).
- Memanggil API service (Koin-injected).
- Tidak menyimpan state global; kalau perlu data lintas screen (mis. user), pakai shared ViewModel atau read ulang dari API.

## Test

- `mobile/app/src/test/java/...MainScreenViewModelTest.kt` — unit test smoke.
- `mobile/app/src/androidTest/java/...MainScreenTest.kt` — instrumented test smoke.
- Belum ada coverage menyeluruh; saat menambah fitur, tambahkan test paralel.

## Gap yang diketahui

Fitur web yang **belum ada** di mobile (atau implementasi minimal):
- Multi-tenant switcher (mobile asumsi 1 tenant aktif).
- Self-service buat/hapus tenant.
- Halaman admin platform.
- Edit transaksi (saat ini hanya void).
- Transfer antar akun (struktur sudah ada di backend, UI mobile belum).
- Export Excel.
- Penyesuaian saldo manual.

Saat membuat versi mobile yang lengkap, gunakan struktur di atas sebagai pondasi dan ikuti pola backend yang sama (zod schema → DTO Kotlin).

## Lanjut baca

- [Frontend routes](./frontend-routes.md) — pembanding feature.
- [API references](./api/) — endpoint yang dipanggil mobile sama dengan web.
- [ADR-012: native Android](../explanation/09-keputusan-arsitektur.md#adr-012-mobile-native-android-bukan-react-native--flutter).
