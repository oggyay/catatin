# Struktur Repo

> Kuadran: **Reference** — peta folder lengkap dengan tanggung jawab tiap file. Pakai sebagai indeks saat membaca kode.

```
finapp/
├── README.md
├── docker-compose.yml          # 4 service: postgres, redis, backend, frontend
├── .env.docker.example         # template ENV untuk docker compose
├── .gitignore / .gitattributes
├── docs/                       # dokumentasi ini
│
├── backend/                    # Node.js + Express + Prisma API
├── frontend/                   # React + Vite web app
└── mobile/                     # Android Kotlin + Compose
```

## Backend

```
backend/
├── package.json                # scripts: dev, start, db:migrate, db:deploy, db:generate, db:seed, db:reset
├── Dockerfile                  # build image production
├── .env.example                # template ENV development
├── .dockerignore
├── prisma/
│   ├── schema.prisma           # semua model + enum
│   ├── seed.js                 # demo tenant + platform admin
│   └── migrations/             # 9 migration berurut (init → add_transfer_fields)
├── scripts/                    # script maintenance lepas
│   ├── backfill-identities.mjs
│   ├── debug.js
│   ├── fix-roles.mjs
│   └── update-admin.js
├── src/
│   ├── server.js               # bootstrap Express, mount routes, rate limit, helmet
│   ├── config/
│   │   ├── prisma.js           # singleton PrismaClient
│   │   ├── redis.js            # lazy-connect Redis client
│   │   ├── plans.js            # PLAN_LIMITS + getPlanLimits()
│   │   └── defaults.js         # DEFAULT_*_CATEGORIES, DEFAULT_ACCOUNT
│   ├── middleware/
│   │   └── auth.js             # authenticate, requireTenant, requireActiveSubscription, requirePlatformAdmin, requireRole
│   ├── routes/
│   │   ├── auth.routes.js      # register, request-otp, verify-otp, me, tenants, switch-tenant, logout
│   │   ├── dashboard.routes.js # summary, recent-transactions
│   │   ├── accounts.routes.js  # CRUD akun + adjust-balance
│   │   ├── categories.routes.js
│   │   ├── transactions.routes.js  # CRUD transaksi + transfer + void
│   │   ├── reports.routes.js   # cashflow JSON + export Excel
│   │   ├── settings.routes.js  # profile, tenant, users, whatsapp link
│   │   ├── admin.routes.js     # platform admin: tenants, users, usage
│   │   └── webhooks.routes.js  # /webhooks/whatsapp inbound
│   ├── services/
│   │   ├── otp.service.js          # requestOtp, verifyOtp (Redis-backed)
│   │   ├── transaction.service.js  # createTransactionAtomic, createTransferAtomic, voidTransactionAtomic, updateTransactionAtomic
│   │   ├── whatsapp-bot.service.js # handleIncomingMessage + intent handler
│   │   └── whatsapp/
│   │       ├── index.js            # sendWhatsapp + getProvider() selector
│   │       ├── parser.js           # heuristic + OpenAI parseCommand
│   │       ├── mock.provider.js
│   │       ├── waha.provider.js
│   │       └── waakg.provider.js
│   └── utils/
│       ├── auth-user.js        # serializeAuthUser
│       ├── date-parser.js      # parseIndonesianDate
│       ├── error.js            # HttpError, asyncHandler, errorHandler
│       ├── format.js           # formatIDR, formatDateID
│       ├── jwt.js              # signToken, verifyToken
│       ├── period.js           # getPeriodRange
│       └── phone.js            # normalizeWhatsappNumber, maskWhatsapp
└── uploads/                    # bukti transaksi (di-mount sebagai volume)
```

### Aturan navigasi backend
- **Mau menambah endpoint baru?** Edit file di `routes/`. Kalau melibatkan saldo / transaksi → panggil service di `services/transaction.service.js`. Lihat [How-to: tambah endpoint](../how-to/tambah-endpoint-api.md).
- **Mau ganti format pesan bot?** Edit `services/whatsapp-bot.service.js`.
- **Mau menambah intent / pola parser?** Edit `services/whatsapp/parser.js`. Lihat [How-to: tambah intent](../how-to/tambah-intent-whatsapp.md).
- **Mau menambah provider?** Buat `services/whatsapp/<name>.provider.js` lalu daftar di `services/whatsapp/index.js`.
- **Mau menambah field di skema DB?** Edit `prisma/schema.prisma`, lalu `npm run db:migrate`. Lihat [How-to: tambah tabel Prisma](../how-to/tambah-tabel-prisma.md).

### Migrations yang ada

| Migration | Inti perubahan |
| --- | --- |
| `20260511125113_init` | Skema awal (Tenant, User, Account, Category, Transaction, dst.) |
| `20260512151759_add_whatsapp_link_token` | Tambah model `WhatsappLinkToken` |
| `20260512153911_add_whatsapp_link_request` | Tambah model `WhatsappLinkRequest` |
| `20260513023151_add_user_soft_delete` | `User.deletedAt`, `deletedWhatsappNumber` |
| `20260513040607_add_tenant_trial_ends_at` | `Tenant.trialEndsAt` |
| `20260513043032_add_tenant_soft_delete` | `Tenant.deletedAt`, `Tenant.status` |
| `20260513075400_add_account_identity_tenant_member` | Tambah `AccountIdentity` & `TenantMember` |
| `20260513080129_relax_legacy_user_identity_uniques` | Relax constraint identity di `User` |
| `20260521000000_add_transfer_fields` | `Transaction.transferGroupId`, `transferDirection` |
| `20260603111800_add_hutang_piutang` | Tambah enum akun `hutang`/`piutang` dan field kontak akun |

## Frontend

```
frontend/
├── package.json                # vite, react, axios, react-router, react-hot-toast, dayjs
├── vite.config.js              # proxy /api dan /uploads ke VITE_API_PROXY (default localhost:4000)
├── index.html                  # entry HTML
├── nginx.conf                  # reverse proxy /api & /uploads → catatin-backend
├── Dockerfile                  # multi-stage build (node build → nginx serve)
├── .env.example
├── src/
│   ├── main.jsx                # ReactDOM bootstrap
│   ├── App.jsx                 # router + Protected guard
│   ├── styles.css              # styling global (single file)
│   ├── context/
│   │   └── AuthContext.jsx     # user, tenants, loading, login, logout, switchTenant, reloadUser
│   ├── lib/
│   │   ├── api.js              # axios instance + token interceptor + 401/403 handler
│   │   └── format.js           # formatIDR, formatDate
│   ├── components/
│   │   ├── AppLayout.jsx       # sidebar + outlet, switch tenant, prompt link WA
│   │   ├── Modal.jsx           # generic modal
│   │   ├── MoneyInput.jsx      # input nominal dengan format IDR
│   │   ├── TransactionForm.jsx # form transaksi standalone
│   │   └── TransactionCreateModal.jsx # form transaksi dalam modal
│   └── pages/
│       ├── Login.jsx
│       ├── Register.jsx
│       ├── VerifyOtp.jsx
│       ├── Dashboard.jsx
│       ├── Transactions.jsx
│       ├── NewTransaction.jsx
│       ├── Accounts.jsx
│       ├── Categories.jsx
│       ├── CashflowReport.jsx
│       ├── SettingsProfile.jsx
│       ├── SettingsUsers.jsx
│       ├── SettingsSubscription.jsx
│       ├── SettingsWhatsapp.jsx
│       ├── AdminTenants.jsx
│       ├── AdminTenantDetail.jsx
│       └── AdminUsage.jsx
```

### Aturan navigasi frontend
- **Mau menambah halaman baru?** Buat `pages/Foo.jsx`, daftar di `App.jsx`, tambahkan link di nav `AppLayout.jsx`. Lihat [How-to: tambah halaman](../how-to/tambah-halaman-frontend.md).
- **Mau menambah field di form?** Edit komponen di `components/` atau langsung di `pages/`.
- **Styling**: semua dalam `src/styles.css` tunggal (sengaja, untuk kemudahan redesign). Tidak ada CSS-in-JS atau utility framework saat ini.
- **State global**: hanya `AuthContext`. Untuk cache/data layer lebih kuat, pertimbangkan React Query (lihat ADR-011).

## Mobile

```
mobile/
├── settings.gradle.kts
├── build.gradle.kts            # version catalog (libs.versions.toml di root)
├── gradle.properties
├── gradlew / gradlew.bat
├── local.properties
└── app/
    ├── build.gradle.kts        # compose, ktor, koin, kotlinx serialization
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml
        │   ├── java/com/example/catatin/
        │   │   ├── CatatinApp.kt           # Application class (Koin start)
        │   │   ├── MainActivity.kt
        │   │   ├── Navigation.kt           # nav graph
        │   │   ├── NavigationKeys.kt       # route keys
        │   │   ├── data/
        │   │   │   ├── DataRepository.kt
        │   │   │   ├── api/
        │   │   │   │   ├── ApiClient.kt    # ktor client config
        │   │   │   │   ├── TokenManager.kt # DataStore-backed token
        │   │   │   │   ├── AuthApiService.kt
        │   │   │   │   ├── DashboardApiService.kt
        │   │   │   │   ├── AccountApiService.kt
        │   │   │   │   ├── CategoryApiService.kt
        │   │   │   │   ├── TransactionApiService.kt
        │   │   │   │   ├── ReportApiService.kt
        │   │   │   │   └── SettingsApiService.kt
        │   │   │   └── model/Models.kt
        │   │   ├── di/AppModule.kt         # Koin modules
        │   │   ├── theme/                  # Color, Theme, Type
        │   │   ├── ui/
        │   │   │   ├── components/CommonComponents.kt
        │   │   │   ├── main/               # MainScreen + ViewModel (shell)
        │   │   │   └── screens/
        │   │   │       ├── auth/{Login,Register,VerifyOtp}Screen.kt + ViewModel
        │   │   │       ├── dashboard/
        │   │   │       ├── transactions/{Transactions,NewTransaction}Screen.kt + ViewModel
        │   │   │       ├── accounts/
        │   │   │       ├── categories/
        │   │   │       ├── reports/CashflowReportScreen.kt + ViewModel
        │   │   │       └── settings/{Profile,Users,Subscription,Whatsapp}Screen.kt + SettingsViewModel
        │   │   └── util/FormatUtils.kt
        │   └── res/                        # ic_launcher (mipmap), themes.xml, strings.xml
        ├── test/                           # MainScreenViewModelTest.kt
        └── androidTest/                    # MainScreenTest.kt
```

### Aturan navigasi mobile
- API base URL hardcoded di `BuildConfig.API_BASE_URL` = `http://10.0.2.2:4000` (host emulator). Ubah di `app/build.gradle.kts` jika deploy ke device fisik atau backend remote.
- Setiap screen punya `Screen.kt` (Composable) dan `ViewModel.kt`. ViewModel memakai `StateFlow` untuk UI state.
- DI lewat Koin (`di/AppModule.kt`).
- Status: implementasi **belum lengkap**; bisa berbeda dari web dalam coverage fitur. Treat sebagai pondasi.

## Docker compose

```
docker-compose.yml              # postgres + redis + backend + frontend
.env.docker.example             # ENV untuk docker compose (POSTGRES_*, JWT_SECRET, WA_*, ...)
```

Volumes:
- `postgres_data` — data PostgreSQL.
- `redis_data` — data Redis (AOF enabled).
- `uploads_data` — upload bukti transaksi (mounted ke backend `/app/uploads`).

Health check:
- Postgres: `pg_isready`.
- Redis: `redis-cli ping`.
- Backend: `GET /health` lewat `node -e fetch(...)`.

Frontend bergantung pada backend healthy sebelum start.

## Lanjut baca

- [Variabel environment](./env-variables.md)
- [Skema database](./database-schema.md)
- [Frontend routes](./frontend-routes.md)
- [Mobile struktur](./mobile-struktur.md)
