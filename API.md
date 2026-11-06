# Shared API contract — camelCase JSON

Backend base no prefix, localhost :4100. `message` string on errors. IDs numeric. Status values `booked|completed|cancelled|noshow`. Dates YYYY-MM-DD; reservation startsAt is ISO timestamp WITH timezone (KST +09:00). All business date/month logic Asia/Seoul. Money KRW integers.

## Auth
- POST /auth/signup {email,password,name,phone} -> {token,user}; creates member only.
- POST /auth/login {email,password,kind:'member'|'staff'} -> {token,user}
- GET /auth/me -> {user}
- POST /auth/logout -> {ok:true}
- POST /auth/change-password {currentPassword,newPassword} -> {ok:true,user}
- user = {id,email,name,kind:'member'|'staff',role:'admin'|'employee'|null,mustChangePassword:boolean}
- Auth header `Authorization: Bearer TOKEN`. Disabled users rejected on every request. mustChangePassword users can access only me/change-password/logout.
- Frontends implement same-origin /api/[...path] proxy using BACKEND_URL; read/write `gym_session` HttpOnly SameSite=Lax cookie, Secure in production. On signup/login store token cookie and return only user. Forward cookie token as Bearer. Strip cookie/token from errors/logs. No client-visible secrets. Frontend functions fetch `/api/...`.

## Shared catalog
GET /catalog -> {trainers:[{id,name,workingDays:number[]}],passTypes:[{id,name,totalSessions,listPrice,validDays}]}; requires login. workingDays Sun=0 ... Sat=6.

## Member
GET /member/dashboard -> {member:{id,name,phone,joinedAt},passes:Pass[],reservations:Reservation[]}
PATCH /member/profile {name,phone} -> {ok:true}
POST /member/reservations {passId,trainerId,startsAt} -> {reservation:Reservation}
POST /member/reservations/:id/cancel -> {ok:true}
Pass = {id,memberId,memberName,typeId,typeName,purchasedOn,paidAmount,expiresOn,totalSessions,usedSessions,bookedSessions,remainingSessions,availableSessions,isUsable:boolean}
Reservation = {id,memberId,memberName,passId,typeName,trainerId,trainerName,startsAt,status,note:string}

## Staff/admin operations (staff auth)
GET /admin/dashboard -> {membersCount,bookedCount,todayCount,expiringPasses:Pass[],trainerStats:[{id,name,completedCount}]}
GET /admin/members?q= -> {members:[{id,name,phone,email,joinedAt}]}; query name or last phone digits.
PATCH /admin/members/:id {name,phone} -> {ok:true}
GET /admin/passes?memberId= -> {passes:Pass[]}
POST /admin/passes {memberId,typeId,purchasedOn,paidAmount,expiresOn?} -> {pass:Pass}
GET /admin/reservations?date=&status= -> {reservations:Reservation[]}; omitted filters = all.
PATCH /admin/reservations/:id {status?,note?} -> {ok:true}
POST /admin/trainers {name,workingDays} -> {trainer:{id,name,workingDays}}
PATCH /admin/trainers/:id {name,workingDays} -> {ok:true}
POST /admin/pass-types {name,totalSessions,listPrice,validDays} -> {passType:...}
PATCH /admin/pass-types/:id {name,totalSessions,listPrice,validDays} -> {ok:true}

## Admin role only
GET /admin/staff -> {staff:[{id,email,name,role,isActive,mustChangePassword}]}
POST /admin/staff {email,name,role:'admin'|'employee'} -> {staff:...,temporaryPassword:string}
PATCH /admin/staff/:id {name?,role?,isActive?} -> {ok:true}; protect last active admin and accidental self-disable.
POST /admin/staff/:id/reset-password -> {temporaryPassword:string}; revoke existing sessions, require password change after next login.

## Setup and safety
Backend dotenv reads .env (never committed). Uses DATABASE_URL and DATABASE_SSL=true; only creates/changes hw2 schema. Separate tables from old assignments. Initial admin seed reads INITIAL_ADMIN_EMAIL/PASSWORD; no committed credentials. Idempotent seed includes fake members/passes/trainers/reservations sufficient to demonstrate expired/used/expiring/completed/noshow. Backend scripts db:setup and db:seed (startup may idempotently ensure).
Each frontend own package.json, lockfile, Next.js app, README. Use versions from bookclub-level2 existing package if possible. Use Node.js 22 or later and pnpm.

## Purchase receipt image attachment (implemented extension)
- POST /admin/passes/:id/receipts {fileName,mimeType,dataBase64} -> {receipts:Receipt[]} (staff only)
- GET /admin/passes/:id/receipts -> {receipts:Receipt[]} (staff only)
- GET /member/passes/:id/receipts -> {receipts:Receipt[]} (own member only)
- Receipt = {id,fileName,mimeType,dataUrl,createdAt}
- JPG/PNG/WebP only, actual file magic/MIME check, filename up to 120 characters, decoded file up to 2MB, up to 5 files per pass, total decoded files per pass <=3,000,000 bytes.
- Stored permanently as bytea in hw2.pass_receipts with pass/uploader foreign keys; no update/delete/OCR or payment verification.

## 트레이너 계정과 승인

화면 경로는 `/trainer`, 브라우저 BFF 경로는 `/trainer-api/*`입니다. 트레이너 BFF는 별도 HttpOnly `gym_trainer_session` 쿠키(Path `/trainer-api`)를 사용하며 기존 관리자 `gym_session`과 분리합니다.

- `POST /auth/login`: `{email,password,kind:'trainer'}`. BFF가 로그인 유형을 강제하고 응답의 token을 쿠키로 옮깁니다.
- `GET /auth/me`, `POST /auth/change-password`, `POST /auth/logout`: 기존 인증 계약과 동일합니다. 최초 비밀번호 변경 전에는 수업 화면을 제공하지 않습니다.
- `GET /trainer/reservations`: `{reservations}`. 본인 담당 수업만 반환하며 기존 예약 필드에 `approval: 'pending' | 'approved' | 'rejected'`가 추가됩니다.
- `PATCH /trainer/reservations/:id`: 승인·거절은 `{approval:'approved'|'rejected',expectedStartsAt}`. `expectedStartsAt`은 조회한 ISO 날짜 그대로 보내며, 일정이 바뀌면 409로 거절합니다. 상태 처리는 `{status:'completed'|'noshow'}`, PT 피드백은 `{note:string}`입니다.
- 거절하면 서버가 `approval:'rejected'`와 `status:'cancelled'`를 함께 저장합니다. 승인 대기 수업은 완료·노쇼로 처리할 수 없습니다.
- 마스터 관리자 전용 `POST /admin/trainers/:id/account` `{email}` 및 `POST /admin/trainers/:id/reset-password` `{}`는 `{temporaryPassword}`를 반환합니다. 임시 비밀번호는 결과창에서 한 번 표시하며 소스·로그에 보관하지 않습니다.
- `GET /admin/catalog`의 트레이너 항목은 `hasAccount`를 제공합니다. 내부 `admin`/`employee` 권한값은 유지하고, 화면에서는 각각 마스터 관리자/부운영자(데스크)로 표시합니다.
