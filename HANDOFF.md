# PWD Observatory Handoff

Date: 2026-05-18

## Scope

This handoff covers the recent mobile self-registration, local GraphQL backend, and login work in:

- `packages/mobile`
- `packages/server`

There are many existing changes under `packages/client` and generated/skill files in the working tree. Those were not reviewed as part of this handoff.

## Local Backend

The local backend is configured around:

- Server URL: `http://192.168.100.130:9000`
- GraphQL endpoint: `http://192.168.100.130:9000/graphql`
- API base URL: `http://192.168.100.130:9000/api/`

The mobile debug config in `packages/mobile/lib/app/core/utils/app_config.dart` points iOS, Android, and desktop debug builds to that LAN server URL.

The server config in `packages/server/config/config.js` also uses host `192.168.100.130` and port `9000`.

## Verified Local Login

Direct GraphQL login was tested successfully against:

```text
http://192.168.100.130:9000/graphql
```

Test account used:

```text
Username/email: admin@pwd.local
Password: 123456
```

The iOS Simulator login was also tested successfully. The app navigated into the main screen and showed:

```text
Hello System Administrator
```

## Mobile Login Changes

`packages/mobile/lib/app/presentation/screens/account/login_screen.dart`

- Replaced the old REST `users/login` call with `UserRepository.login(...)`, which uses GraphQL.
- Saves the returned GraphQL token into `SharedPreferences` as `auth_token`.
- Builds a local mobile session from the UUID-based GraphQL user by mapping:
  - `remote_id` to the server user UUID
  - `user_id` to the server user UUID
  - local `id` to `1`, because the legacy local model expects an integer id
  - `remember_token` to the GraphQL JWT
- Navigates to `AppConfig.FullApp` after successful login.

`packages/mobile/lib/app/domain/controllers/user_controller.dart`

- Removed the early return after `UserRepository.login`.
- Updates controller state from the GraphQL response before navigating.

`packages/mobile/ios/Runner/Info.plist`

- Added `NSAppTransportSecurity` with `NSAllowsArbitraryLoads` for local HTTP testing on the iOS Simulator.

## Server Auth Fix

`packages/server/server.js`

- The GraphQL context previously relied only on `operationName` for public operation exemptions.
- Some clients can omit/null `operationName`, causing `login` to be blocked with:

```text
Access denied. No token provided.
```

- The context now also checks the GraphQL query text for exempt public operations such as `Login`, `Register`, `Disabilities`, `Districts`, and others.

## Self-Registration Flow

`packages/mobile/lib/app/presentation/screens/account/RegisterScreen.dart`

The mobile self-registration flow is now:

1. Create account
   - First name
   - Last name
   - Phone/email
   - Password

2. Ask whether the user is registering as a Person With Disability
   - `Yes` continues to the PWD profile form
   - `No` finishes onboarding with account-only registration

3. PWD profile form
   - Bio data
   - Profile image
   - DOB with custom themed date picker
   - District selectors
   - Education/disability fields
   - Employment/aspirations
   - Next of kin

Recent UI fixes:

- The `Yes`/`No` options on Step 2 are now visible, full-width choice rows.
- The Step 2 CTA says `Choose Yes or No` until a choice is selected.
- The second section after Bio data was renamed from `Next of kin` to `Additional bio data`, because it captures additional personal details.
- The DOB field no longer uses `FormBuilderDateTimePicker`; it uses a controlled `showDatePicker`.
- After DOB selection, the form restores the previous scroll offset to avoid the automatic jump down the form.
- Form validation uses `AutovalidateMode.disabled`, so untouched required fields should not show errors while the user is initially filling the form. Errors appear on continue/submit.
- The duplicate `Disabilities`, `Other disability`, `Employed`, `Employment`, and `Aspirations` fields were removed from the Bio data section. Those fields now appear only once in the `Education and disability` section.
- Disability selection was changed from a large inline chip wall to a compact `FormBuilderField` summary that opens a searchable bottom-sheet multi-select.
- District fields were changed from normal dropdowns to searchable bottom-sheet pickers backed by `FormBuilderField`, so both `District of origin` and `District attached` use the same loaded district list.

## GraphQL Data Used By Registration

`packages/mobile/lib/app/data/graphql/graphql_documents.dart`

Added/updated:

- `login`
- `register`
- `createPwd`
- `requestPasswordResetLink`
- `disabilities`
- `districts`

District query currently requests:

```graphql
query Districts {
  districts {
    id
    name
    created_at
    updated_at
  }
}
```

Disability query:

```graphql
query Disabilities {
  disabilities {
    id
    name
  }
}
```

`RegisterScreen.dart` now loads:

- Districts through `UserRepository.getDistricts()`
- Disabilities through `UserRepository.getDisabilities(refresh: true)`

District fields are searchable bottom-sheet pickers:

- `District of origin`
- `District attached`

Disabilities are rendered as a compact searchable multi-select bottom sheet plus an optional `Other disability` field.

Important parsing fix:

- The GraphQL backend returns `id` values for districts/disabilities as strings.
- `packages/mobile/lib/app/data/models/district.dart` and `packages/mobile/lib/app/data/models/disabilities.dart` now parse string or numeric IDs. Before this, the generated JSON cast expected `num`, causing districts/disabilities to fail before state update.

## PWD Mobile Screen Improvement Approach

When improving mobile screens for persons with disabilities, keep the design direction accessibility-first rather than visually subtle. The app should remain bold, readable, and easy to operate for users with low vision, motor limitations, and screen-reader needs.

Current improvement pattern:

- Start from the existing app style and preserve the strong civic-tech palette: primary blue, green/red service colors where already used, white text on dark surfaces, and clear section boundaries.
- Use large readable typography, but do not rely on global shrink factors to solve overflow. Default text scale should remain `1.0` or higher; reduce only specific overflowing labels locally.
- Use high-contrast labels and controls. Avoid pale grey text for important information.
- Prefer large tap targets: cards, bottom navigation actions, form choices, and CTA buttons should be easy to hit.
- Replace cramped inline lists with searchable bottom sheets when data is long, especially districts and disabilities.
- Keep form validation calm: avoid showing errors before the user attempts to continue or submit.
- Add explicit loading, empty, and error states on list screens instead of blank areas or endless spinners.
- Normalize GraphQL responses in repositories before they reach legacy mobile models, especially `ID` strings, nullable dates, and millisecond timestamp strings.
- Keep cache keys versioned when response shape changes so old REST-shaped data is not reused accidentally.
- Prefer safe fallback UI for nullable backend fields: missing photos use `AppConfig.NO_IMAGE`, invalid dates show `Recently added`, missing labels show useful fallback text.
- Run targeted `dart format` and targeted `flutter analyze`/`dart analyze` on changed files. Existing lint noise is common in this codebase, so note whether there are compile errors versus old style warnings.

Global text/accessibility fix:

- `packages/mobile/lib/app/core/theme/accessibility_theme_manager.dart`
  - Saved `text_scale_factor` values below `1.0` are now upgraded back to `1.0` on startup.
  - Text scaling is clamped to `1.0 -> 3.0` so the app cannot globally shrink text below normal size.
- `packages/mobile/lib/app/core/accessibility/accessibility_controls.dart`
  - Removed the `Small (80%)` quick text option.
  - Text size slider now starts at `100%`.
- `packages/mobile/lib/app/core/utils/my_widgets.dart`
  - Removed a hardcoded `0.5` `textScaleFactor` from a shared rich-text helper and made it respect the active `MediaQuery` text scaler.

Screens improved so far:

- `packages/mobile/lib/app/presentation/screens/account/RegisterScreen.dart`
  - Self-registration flow, PWD profile sections, district/disability pickers, validation behavior, DOB picker, duplicate disability fields cleanup, and `Additional bio data` rename.
- `packages/mobile/lib/app/presentation/screens/full_app/full_app.dart`
  - Main dashboard alignment, service card hierarchy, bottom navigation sizing, and accessible high-contrast dashboard styling.
- `packages/mobile/lib/app/presentation/screens/full_app/more_services_screen.dart`
  - More Services screen restyled to match the dashboard and logout icon fixed.
- `packages/mobile/lib/app/presentation/screens/shop/ProductsScreen.dart`
  - Products/services list header, loading/empty/error states, refresh behavior, and accessible list structure.
- `packages/mobile/lib/app/presentation/screens/shop/ProductScreen.dart`
  - Product detail UX with clear hero image, strong price section, readable metadata, details block, and sticky call-seller action.
- `packages/mobile/lib/app/presentation/widgets/widgets.dart`
  - Shared product, news, innovation, counseling, and service-provider card/list widgets were hardened for nullable GraphQL data and better PWD-friendly presentation.
- `packages/mobile/lib/app/presentation/screens/services/ServiceProvidersScreen.dart`
  - Service provider listing connected to GraphQL with loading/error handling.
- `packages/mobile/lib/app/presentation/screens/services/CounsellorsScreen.dart`
  - Counseling services connected to GraphQL and refresh made awaitable through the service controller.
  - Counseling list was improved with an accessibility-first header, large search field, horizontal quick filters for call/online/location availability, clearer result counts, saved-data refresh warning, and explicit loading/empty/error states.
- `packages/mobile/lib/app/presentation/screens/news/NewsPostsScreen.dart`
  - News list connected to GraphQL, refresh fixed, and empty/loading behavior corrected.
- `packages/mobile/lib/app/presentation/screens/news/NewsPostScreen.dart`
  - News detail made safer for nullable photos/category values.
- `packages/mobile/lib/app/presentation/screens/services/InnovationsScreen.dart`
  - Innovations list connected to GraphQL, refresh fixed, and empty/loading behavior corrected.
  - Innovations list was improved with an accessibility-first header, large search field, horizontal quick filters for status/type/image availability, clearer result counts, saved-data refresh warning, and explicit loading/empty/error states.
- `packages/mobile/lib/app/presentation/screens/events/InnovationDetails.dart`
  - Innovation detail was rebuilt as a readable detail view with safe image fallback, strong title/type/status/date treatment, accessible content sections, and the old non-functional contact FAB removed.
- `packages/mobile/lib/app/presentation/screens/full_app/ai_chat_screen.dart`
  - AI assistant screen connected to the GraphQL AI assistant instead of static-only responses.

## Server PWD/Profile Changes

`packages/server/schema/pwd/resolvers.js`

- `createPwd` now allows authenticated self-registration users to create a PWD profile.
- Update/delete remain permission-protected.

`packages/server/schema/user/resolvers.js`

- Registration fallback was adjusted to tolerate the local role name `PWD.  ` by trimming whitespace and trailing periods when looking up the default PWD role.
- Public self-registration now writes `status: "pending"` for new users, because self-registered users must be reviewed/verified.
- A compatibility helper, `ensureUserStatusColumn`, adds `users.status` at runtime if an older local database is missing the column.

`packages/server/schema/user/typeDefs.js`

- Added `User.status`.
- Added optional `CreateUserInput.status` for admin-created/updated users.

`packages/server/sql/001_auth_schema.sql`

- Added `users.status VARCHAR(30) NOT NULL DEFAULT 'active'`.

`packages/server/sql/013_user_status.sql` and `packages/server/sql/017_user_status.sql`

- Both files currently exist and do the same status-column migration/backfill. This duplication should be cleaned up before committing. Keep one migration only.

## Service Providers, Products, and Services

Service providers were connected to the GraphQL backend from the mobile app and now handle loading/error states in the service provider listing flow.

Recent mobile UI work:

- `packages/mobile/lib/app/presentation/screens/full_app/full_app.dart`
  - Main dashboard was tuned for better alignment and accessible but less oversized text.
  - Bottom navigation and service tiles keep the high-contrast dashboard direction.
- `packages/mobile/lib/app/presentation/screens/full_app/more_services_screen.dart`
  - More Services was restyled to match the main dashboard.
  - Broken logout icon was fixed.
- `packages/mobile/lib/app/presentation/screens/shop/ProductScreen.dart`
  - Product details screen was redesigned for PWD-friendly UX with larger readable sections, strong price treatment, clearer metadata rows, and a sticky call-seller action.
- `packages/mobile/lib/app/presentation/screens/shop/ProductsScreen.dart`
  - Products and services listing now has an accessible header, pull-to-refresh, and proper loading/empty/error states.
- `packages/mobile/lib/app/presentation/widgets/widgets.dart`
  - `productWidget` was rebuilt as a larger tappable card with bigger imagery, high-contrast price band, type/date chips, and safer null handling.

Current mobile debug URLs:

- `packages/mobile/lib/app/core/utils/app_config.dart`: `http://192.168.100.130:9000`
- `packages/mobile/lib/app/core/constants/constants.dart`: `http://192.168.100.130:9000/products/`

## Counseling GraphQL Integration

Counseling services on the mobile app were connected to the local GraphQL backend.

Backend endpoint/schema already available:

- Query: `counsellingCentres(limit: Int, offset: Int, search: String)`
- Server files:
  - `packages/server/schema/counselling_centres/typeDefs.js`
  - `packages/server/schema/counselling_centres/resolvers.js`
- Public auth exemption:
  - `packages/server/server.js` includes `CounsellingCentres` in the exempt GraphQL operation list.

Mobile files changed:

- `packages/mobile/lib/app/data/graphql/graphql_documents.dart`
  - Expanded `GraphQLDocuments.counsellingCentres` to fetch the full counseling centre shape needed by mobile:
    - identity/contact fields
    - `target_group`
    - location fields
    - `website`
    - `affiliated_organisations`
    - `fees_range`
    - `gps_latitude`/`gps_longitude`
    - `created_at`/`updated_at`
    - `districts_of_operations`
    - `disability_categories`
- `packages/mobile/lib/app/data/repositories/graphql_service_repository.dart`
  - `getConsellors(...)` now reads from `GraphQLDocuments.counsellingCentres`.
  - Cache key was bumped to `graphql_getConsellors_v2` so old REST-shaped cache data is not reused.
  - Added `_normalizeCounsellingCentreRow(...)` to convert GraphQL `ID` string values into integer IDs for the generated `Consellor` model.
  - Normalizes `created_at` and `updated_at`, including millisecond timestamp strings.
  - Maps `districts_of_operations` names into `subcounty_text` for the existing mobile card/detail model.
  - Maps `disability_categories` names into `disability_categories_text` so the mobile card/detail views can show supported disability categories.
- `packages/mobile/lib/app/presentation/widgets/widgets.dart`
  - `counsellorWidget(...)` now safely formats nullable backend dates.
  - If `created_at` is null or invalid, the card shows `Recently added` instead of crashing on `DateTime.parse`.

Important backend response details:

- The GraphQL API returns counseling `id` as a string, for example `"38"`, because the schema type is `ID`.
- Some records return `created_at: null`.
- Some records return timestamp strings such as `"1720402045000"`.
- Direct backend verification confirmed `counsellingCentres` returns records from the local server.

## News GraphQL Integration

News on the mobile app was connected to the local GraphQL backend and cleaned up to avoid falling back to the legacy REST/local `NewsPost` refresh path.

Backend endpoint/schema already available:

- Query: `newsItems(limit: Int, offset: Int, search: String)`
- Server files:
  - `packages/server/schema/news/typeDefs.js`
  - `packages/server/schema/news/resolvers.js`
- Public auth exemption:
  - `packages/server/server.js` now includes `NewsItems` in the exempt GraphQL operation list.

Mobile files changed:

- `packages/mobile/lib/app/data/graphql/graphql_documents.dart`
  - Existing `GraphQLDocuments.newsItems` is used by the mobile repository and fetches:
    - `id`
    - `created_at`
    - `updated_at`
    - `title`
    - `description`
    - `photo`
    - `details`
    - `post_category { name }`
- `packages/mobile/lib/app/data/repositories/graphql_service_repository.dart`
  - `getNews(...)` reads from `GraphQLDocuments.newsItems`.
  - Cache key was bumped to `graphql_getNews_v2` so old REST-shaped or pre-normalized cache data is not reused.
  - Added `_normalizeNewsRow(...)` to convert GraphQL `ID` string values into integer IDs for the generated `News` model.
  - Normalizes `created_at` and `updated_at`, including millisecond timestamp strings.
  - Maps `post_category.name` into `post_category_text` for the existing mobile list/detail widgets.
- `packages/mobile/lib/app/domain/controllers/service_controller.dart`
  - `fetchNews(...)` now returns `Future<void>` so refresh callers can await completion.
- `packages/mobile/lib/app/presentation/screens/news/NewsPostsScreen.dart`
  - Pull-to-refresh now calls `serviceController.fetchNews(refresh: true)` instead of legacy `NewsPost.getItems()`.
  - Empty/loading state logic was fixed so an empty GraphQL response shows the empty state instead of being masked by the loading branch.
  - Removed unused legacy `NewsPost` refresh state.
- `packages/mobile/lib/app/presentation/widgets/widgets.dart`
  - `newsPostWidget(...)` now handles nullable `photo` and missing `postCategoryText` safely.
- `packages/mobile/lib/app/presentation/screens/news/NewsPostScreen.dart`
  - Detail screen now handles nullable `photo` and missing `postCategoryText` safely.
  - Removed unused legacy `NewsPost` import.

Important backend response details:

- The GraphQL API returns news `id` as a string, for example `"21"`, because the schema type is `ID`.
- The local backend returned timestamp strings such as `"1773237107000"` for `created_at`/`updated_at`.
- Direct backend verification confirmed `newsItems` returns records from the local server without authentication after adding the `NewsItems` exemption.

## Innovations GraphQL Integration

Innovations on the mobile app were connected to the local GraphQL backend and hardened to match the existing news/counseling GraphQL migration pattern.

Backend endpoint/schema already available:

- Query: `innovations(limit: Int, offset: Int, search: String)`
- Server files:
  - `packages/server/schema/innovations/typeDefs.js`
  - `packages/server/schema/innovations/resolvers.js`
- Public auth exemption:
  - `packages/server/server.js` now includes `Innovations` in the exempt GraphQL operation list.

Mobile files changed:

- `packages/mobile/lib/app/data/graphql/graphql_documents.dart`
  - Existing `GraphQLDocuments.innovations` is used by the mobile repository and fetches:
    - `id`
    - `created_at`
    - `updated_at`
    - `title`
    - `innovation_type`
    - `photo`
    - `innovation_status`
    - `description`
- `packages/mobile/lib/app/data/repositories/graphql_service_repository.dart`
  - `getInnovations(...)` reads from `GraphQLDocuments.innovations`.
  - Cache key was bumped to `graphql_getInnovations_v2` so old REST-shaped or pre-normalized cache data is not reused.
  - Added `_normalizeInnovationRow(...)` to convert GraphQL `ID` string values into integer IDs for the generated `Innovation` model.
  - Normalizes `created_at` and `updated_at`, including millisecond timestamp strings.
- `packages/mobile/lib/app/domain/controllers/service_controller.dart`
  - `fetchInnovations(...)` now returns `Future<void>` so refresh callers can await completion.
- `packages/mobile/lib/app/presentation/screens/services/InnovationsScreen.dart`
  - Pull-to-refresh now calls `serviceController.fetchInnovations(refresh: true)` instead of the legacy `EventModel.getItems()` path.
  - Empty/loading state logic was fixed so an empty GraphQL response shows the empty state instead of being masked by the loading branch.
- `packages/mobile/lib/app/presentation/widgets/widgets.dart`
  - `innovationWidget(...)` now safely formats nullable backend dates.
  - If `created_at` is null or invalid, the card shows `Recently added` instead of crashing on `DateTime.parse`.
  - Missing titles and photos are handled with fallback display behavior.

Important backend response details:

- The GraphQL API returns innovation `id` as a string, for example `"25"`, because the schema type is `ID`.
- Some records return `created_at: null`.
- Some records return timestamp strings such as `"1751257380000"`.
- Direct backend verification confirmed `innovations` returns records from the local server without authentication after adding the `Innovations` exemption.

## AI Assistant Work

The GraphQL server now has an AI assistant implementation based on the previous Laravel admin server idea.

Server files:

- `packages/server/services/pwdAiAssistantService.js`
- `packages/server/schema/ai/typeDefs.js`
- `packages/server/schema/ai/resolvers.js`
- AI schema/resolvers are wired into `packages/server/server.js`

Mobile files:

- `packages/mobile/lib/app/data/repositories/graphql_ai_repository.dart`
- `packages/mobile/lib/app/data/graphql/graphql_documents.dart`
- `packages/mobile/lib/app/presentation/screens/full_app/ai_chat_screen.dart`

Notes:

- The assistant supports model answers plus database-backed context/RAG-style responses.
- Environment variables expected by the server are `GROQ_API_KEY` and `GROQ_MODEL`.
- The server also accepts the common typo alias `GROK_API_KEY`.
- A previous issue where live Groq answers were being replaced by static fallback text was fixed.

## Verification Performed

Commands/checks run successfully:

```bash
node --check packages/server/server.js
node --check packages/server/schema/user/resolvers.js
node --check packages/server/schema/pwd/resolvers.js
node --check packages/server/schema/user/typeDefs.js
```

Targeted Flutter analysis was run on the changed mobile files. There were no compile errors after fixes. Remaining analyzer output is existing naming/style lint noise such as:

- `RegisterScreen.dart` filename casing
- `error_message` variable naming
- legacy `AppConfig` uppercase constants/getters
- existing `print` usage in `user_controller.dart`

Additional targeted Flutter analysis on 2026-05-18 for counseling GraphQL files completed with no compile errors:

```bash
cd /Users/MAC/Documents/Projects/8tech/pwd_observatory/packages/mobile
flutter analyze lib/app/data/repositories/graphql_service_repository.dart lib/app/data/graphql/graphql_documents.dart lib/app/presentation/widgets/widgets.dart lib/app/presentation/screens/services/CounsellorsScreen.dart
```

Remaining output was existing lint/style noise in `CounsellorsScreen.dart` and `widgets.dart`, including filename casing, unnecessary imports, deprecated `withOpacity`, naming lints, unused labels, and `prefer_const_constructors`.

Direct local GraphQL counseling check on 2026-05-18 returned HTTP 200 and counseling centre records:

```bash
curl -sS -i -X POST http://192.168.100.130:9000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"operationName":"CounsellingCentres","query":"query CounsellingCentres($limit: Int, $offset: Int) { counsellingCentres(limit: $limit, offset: $offset) { id name target_group about address parish village phone_number phone_number_2 email website affiliated_organisations skills fees_range photo gps_latitude gps_longitude created_at updated_at status districts_of_operations { id name } disability_categories { id name } } }","variables":{"limit":2,"offset":0}}'
```

Direct local GraphQL news check on 2026-05-18 returned HTTP 200 and news records:

```bash
curl -sS -i -X POST http://192.168.100.130:9000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"operationName":"NewsItems","query":"query NewsItems($limit: Int, $offset: Int) { newsItems(limit: $limit, offset: $offset) { id created_at updated_at title description photo details post_category { name } } }","variables":{"limit":2,"offset":0}}'
```

Direct local GraphQL innovations check on 2026-05-18 returned HTTP 200 and innovation records:

```bash
curl -sS -i -X POST http://192.168.100.130:9000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"operationName":"Innovations","query":"query Innovations($limit: Int, $offset: Int) { innovations(limit: $limit, offset: $offset) { id created_at updated_at title innovation_type photo innovation_status description } }","variables":{"limit":2,"offset":0}}'
```

Additional targeted Flutter analysis on 2026-05-18 for News GraphQL files completed with no compile errors:

```bash
cd /Users/MAC/Documents/Projects/8tech/pwd_observatory/packages/mobile
flutter analyze lib/app/data/repositories/graphql_service_repository.dart lib/app/domain/controllers/service_controller.dart lib/app/data/graphql/graphql_documents.dart lib/app/presentation/widgets/widgets.dart lib/app/presentation/screens/news/NewsPostsScreen.dart lib/app/presentation/screens/news/NewsPostScreen.dart
```

Remaining output was existing lint/style noise in `NewsPostsScreen.dart`, `NewsPostScreen.dart`, and `widgets.dart`, including filename casing, unnecessary imports, deprecated `withOpacity`, naming lints, unused labels, and `prefer_const_constructors`.

iOS Simulator builds launched successfully after the login and registration changes.

Additional simulator verification on 2026-05-14:

- `flutter run -d 44395BBA-5BE7-4960-890E-B52CE74D7056 --no-resident` built and launched on the iPhone 11 simulator.
- Onboarding skip works.
- Create account screen opens.
- Step 2 `Yes` and `No` selection works, and `Yes` advances to Step 3.
- Step 3 shows `Bio data`, then `Additional bio data`; duplicate disability fields are no longer visible in Bio data.
- Gender dropdown opens and selection works.
- Validation appears on submit and scrolls/keeps the user near the invalid field.

Incomplete simulator verification:

- Full `Create account and profile` submission was not completed from the UI before interruption.
- Computer Use interaction with Flutter fields was unreliable for phone input at first: the phone field visually showed `0712345678`, but validation still reported `Phone number is required` until typed directly into the focused field. This may be a test automation artifact, but it is worth checking manually.
- Scrolling further down Step 3 through Computer Use did not reach the Identification/Education sections during the interrupted test, so the `District attached` and disability bottom sheets were not visually verified in the simulator. Direct backend checks confirmed district/disability queries return data.

## Useful Commands

Run local server:

```bash
cd /Users/MAC/Documents/Projects/8tech/pwd_observatory/packages/server
bun --watch server.js
```

Run mobile app on the open iOS Simulator:

```bash
cd /Users/MAC/Documents/Projects/8tech/pwd_observatory/packages/mobile
flutter run -d 44395BBA-5BE7-4960-890E-B52CE74D7056 --no-resident
```

Direct local GraphQL login check:

```bash
curl -sS -i -X POST http://192.168.100.130:9000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"operationName":"Login","query":"mutation Login($username: String!, $password: String!) { login(username: $username, password: $password) { success message token user { id username name email phone_number } } }","variables":{"username":"admin@pwd.local","password":"123456"}}'
```

Direct local GraphQL catalog checks:

```bash
curl -sS -i -X POST http://192.168.100.130:9000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"operationName":"Districts","query":"query Districts { districts { id name } }"}'

curl -sS -i -X POST http://192.168.100.130:9000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"operationName":"Disabilities","query":"query Disabilities { disabilities { id name } }"}'
```

Direct local GraphQL counseling check:

```bash
curl -sS -i -X POST http://192.168.100.130:9000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"operationName":"CounsellingCentres","query":"query CounsellingCentres($limit: Int, $offset: Int) { counsellingCentres(limit: $limit, offset: $offset) { id name target_group about address parish village phone_number phone_number_2 email website affiliated_organisations skills fees_range photo gps_latitude gps_longitude created_at updated_at status districts_of_operations { id name } disability_categories { id name } } }","variables":{"limit":2,"offset":0}}'
```

Direct local GraphQL news check:

```bash
curl -sS -i -X POST http://192.168.100.130:9000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"operationName":"NewsItems","query":"query NewsItems($limit: Int, $offset: Int) { newsItems(limit: $limit, offset: $offset) { id created_at updated_at title description photo details post_category { name } } }","variables":{"limit":2,"offset":0}}'
```

Direct local GraphQL innovations check:

```bash
curl -sS -i -X POST http://192.168.100.130:9000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"operationName":"Innovations","query":"query Innovations($limit: Int, $offset: Int) { innovations(limit: $limit, offset: $offset) { id created_at updated_at title innovation_type photo innovation_status description } }","variables":{"limit":2,"offset":0}}'
```

## Known Follow-Ups

- Confirm the full self-registration PWD profile submission against the local backend with real data.
- Confirm `users.status = 'pending'` after self-registration in the local database.
- Manually verify the mobile Counseling Services list/detail flow in the iOS Simulator after the GraphQL connection.
- Manually verify the mobile News list/detail flow in the iOS Simulator after the GraphQL connection.
- Manually verify the mobile Innovations list/detail flow in the iOS Simulator after the GraphQL connection.
- Clean up duplicate status migrations: `packages/server/sql/013_user_status.sql` and `packages/server/sql/017_user_status.sql`.
- Decide whether local debug URL should remain hardcoded to `192.168.100.130` or be passed through `--dart-define=LOCAL_GRAPHQL_ENDPOINT=...`.
- Manually verify the Step 3 searchable bottom sheets for `District of origin`, `District attached`, and `Disabilities` in the simulator or on device.
- Clean up analyzer style lints only if the team wants a broader naming refactor.
- Review untracked `packages/mobile/` git state before committing, since git currently reports the whole mobile package as untracked in this checkout.
- Review unrelated `packages/client` changes separately before staging or committing.
