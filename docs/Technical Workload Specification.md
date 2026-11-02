# SwiftDrop Enterprise Platform: Master Technical Workload Specification

**Document Title:** 100% Comprehensive Future Workload, Architecture Blueprints, and Technical Task Specifications  
**Target Repository:** `nyxora-swiftdrop`  
**Target Architecture:** Cloud-Native Spring Boot 3 Microservices, Spring Cloud Gateway, Next.js (App Router), PostgreSQL 15, RabbitMQ (Topic & DLQ), Kubernetes  
**Document Scope:** All Remaining System Workloads (Milestones 2 through 6, Bonus Features, Automated Testing, Security Hardening). 
---

## Table of Contents
1. [Architecture Blueprint & Cross-Service Data Boundary Rules](#1-architecture-blueprint--cross-service-data-boundary-rules)
2. [Module 1: `services/parcel-service` (Logistics Core & Dispatch Engine)](#2-module-1-servicesparcel-service-logistics-core--dispatch-engine)
3. [Module 2: `services/auth-service` (Internal & Self-Service Extensions)](#3-module-2-servicesauth-service-internal--self-service-extensions)
4. [Module 3: `services/notification-webhook-service` (Event Messaging & Outbound Webhooks)](#4-module-3-servicesnotification-webhook-service-event-messaging--outbound-webhooks)
5. [Module 4: `services/api-gateway` (Perimeter Routing & Security Expansion)](#5-module-4-servicesapi-gateway-perimeter-routing--security-expansion)
6. [Module 5: `services/ai-assistant-service` (Generative AI & MCP Tools - Bonus +5)](#6-module-5-servicesai-assistant-service-generative-ai--mcp-tools---bonus-5)
7. [Module 6: `frontend/` (Next.js 14+ Responsive Web Applications)](#7-module-6-frontend-nextjs-14-responsive-web-applications)
8. [Module 7: DevOps, Containerization & Kubernetes (Bonus +5)](#8-module-7-devops-containerization--kubernetes-bonus-5)
9. [Module 8: Quality Assurance, JaCoCo Coverage & Testing (15 Marks)](#9-module-8-quality-assurance-jacoco-coverage--testing-15-marks)
10. [Module 9: Cross-Cutting Concerns & Security Guardrails](#10-module-9-cross-cutting-concerns--security-guardrails)
11. [Module 10: Technical Documentation, Academic Report & Demo Preparation (35 Marks)]
---

## 1. Architecture Blueprint & Cross-Service Data Boundary Rules

SwiftDrop operates on three physically isolated databases hosted on PostgreSQL 15 (`auth_db`, `parcel_db`, `notification_db`). To prevent architectural anti-patterns, data leakage, and cross-database access violations, all inter-service coordination follows strict patterns:

```mermaid
flowchart TD
    subgraph Edge ["Perimeter"]
        GW["API Gateway (Port 8080)<br/>- Perimeter JWT + RBAC<br/>- Claim Enrichment (X-User-Id, X-Courier-Id, X-Merchant-Id)<br/>- Internal Route Blocking (/internal/**)"]
    end

    subgraph Microservices ["Spring Boot 3 (Java 21) Microservices"]
        AS["auth-service (8081)"]
        PS["parcel-service (8082)"]
        NWS["notification-webhook-service (8083)"]
        AI["ai-assistant-service (8084)"]
    end

    subgraph Storage ["PostgreSQL 15 (Isolated DBs)"]
        AuthDB[("auth_db")]
        ParcelDB[("parcel_db")]
        NotifDB[("notification_db")]
    end

    subgraph Messaging ["RabbitMQ (AMQP 0-9-1)"]
        TopicEx["Exchange: swiftdrop.events.topic"]
        DLX["Dead-Letter Exchange: swiftdrop.dlx"]
    end

    GW -->|Forward Auth & Merchant Self-Service| AS
    GW -->|Forward Parcels, Quotes, Runsheets, Orders| PS
    GW -->|Forward Webhook Logs & Demo Receiver| NWS
    GW -->|Forward Chat & MCP Tools| AI

    AS --> AuthDB
    PS --> ParcelDB
    NWS --> NotifDB

    PS -->|Publish: parcel.created, parcel.status.updated| TopicEx
    TopicEx -->|Consume: parcel.status.updated| NWS
    TopicEx -->|Consume: parcel.assigned, parcel.status.delivered, parcel.status.failed| AS
    NWS -->|Retry on Failure (TTL)| DLX
    DLX -->|Republish after Backoff| TopicEx

    NWS -.->|Internal REST: Fetch Merchant Webhook Config| AS
    AI -.->|Internal REST: Status & Rates| PS
```
 
*(Note: Facebook & Apple credentials setup in `.env` and baseline components already merged into `main` and `dev` are strictly excluded from this document).*

### Critical Cross-Service Coordination Rules:
1. **Zero Cross-Database Foreign Keys or Queries:** Microservices never query another service's database directly.
2. **Merchant Webhook Config Retrieval:** Because `merchants.webhook_url` and `webhook_secret` reside in `auth_db`, `notification-webhook-service` retrieves this via an internal service REST endpoint (`GET /api/v1/auth/internal/merchants/{merchantId}/webhook-config`) with caching (Caffeine/Spring Cache), preserving database decoupling.
3. **Courier Workload Synchronization:** `couriers.active_delivery_count` in `auth_db` is updated asynchronously by listening to RabbitMQ parcel lifecycle events (`parcel.assigned` $\rightarrow +1$, `parcel.status.delivered` $\rightarrow -1$, `parcel.status.failed` $\rightarrow -1$), keeping the Dispatcher's courier sorting live and accurate.
4. **Role Entity ID Propagation:** To eliminate unnecessary database lookups across services, API Gateway enriches downstream requests with `X-Courier-Id` and `X-Merchant-Id` (derived from JWT claims) alongside `X-User-Id` and `X-User-Role`.

---

## 2. Module 1: `services/parcel-service` (Logistics Core & Dispatch Engine)
**Service Port:** `8082` | **Database:** `parcel_db` | **Dependencies:** Spring Boot 3.3.x, Spring Data JPA, Spring WebSocket (STOMP), Spring AMQP (RabbitMQ), Jakarta Validation, Modern JJWT (shared security slice), OpenPDF / iText.

### Task 1.1: Domain Entities & JPA Repositories (Matching `init-multi-db.sql`)
- **Objective:** Create domain entities mapping 1:1 to the committed `parcel_db` schema without column drift.
- **Entities:**
  1. `DeliveryZone.java` (`delivery_zones` table):
     - `id` (Integer PK), `zoneCode` (`VARCHAR(20)` unique, e.g. `WP-COL-01`), `zoneName` (`VARCHAR(100)`), `district` (`VARCHAR(50)`), `baseSurcharge` (`BigDecimal`), `isActive` (`Boolean`).
  2. `PricingRule.java` (`pricing_rules` table):
     - `id` (Integer PK), `originZone` (ManyToOne `DeliveryZone`), `destinationZone` (ManyToOne `DeliveryZone`), `baseFee` (`BigDecimal`), `ratePerKg` (`BigDecimal`), `parcelSize` (`VARCHAR(30)` - `SMALL`, `MEDIUM`, `LARGE`), `sizeMultiplier` (`BigDecimal` default 1.00).
     - Table constraint: `UNIQUE(origin_zone_id, destination_zone_id, parcel_size)`.
  3. `Parcel.java` (`parcels` table):
     - `id` (UUID PK), `trackingNumber` (`VARCHAR(50)` unique), `senderUserId` (UUID), `merchantId` (UUID, nullable), `assignedCourierId` (UUID, nullable), `originZone` (ManyToOne `DeliveryZone`), `destinationZone` (ManyToOne `DeliveryZone`), `pickupAddress` (String), `dropoffAddress` (String), `recipientName` (String), `recipientPhone` (String), `weightKg` (`BigDecimal`), `parcelSize` (String), `estimatedFee` (`BigDecimal`), `currentStatus` (`ParcelStatus` enum default `CREATED`), `createdAt` (Timestamp), `updatedAt` (Timestamp).
  4. `ParcelStatusHistory.java` (`parcel_status_history` table):
     - `id` (UUID PK), `parcel` (ManyToOne `Parcel`), `status` (`ParcelStatus`), `updatedByUserId` (UUID), `deliveryNote` (String), `recipientSignatureName` (String), `proofPhotoUrl` (String), `failureReason` (String), `createdAt` (Timestamp).
- **Repositories:** `DeliveryZoneRepository`, `PricingRuleRepository`, `ParcelRepository`, `ParcelStatusHistoryRepository`.

### Task 1.2: Dynamic Pricing Engine (GoF Strategy Pattern)
- **Objective:** Fulfill the assignment requirement for the Strategy Pattern by calculating dynamic delivery fees based on distance, weight, size, merchant tier, and delivery speed.
- **Components:**
  - `PricingStrategy.java` (Interface):
    ```java
    public interface PricingStrategy {
        BigDecimal calculateFee(ParcelQuoteRequest request, PricingRule rule, DeliveryZone destZone);
        boolean supports(QuoteTier tier);
    }
    ```
  - `StandardZonePricingStrategy.java` (Implementation):
    $$\text{Fee} = \left(\text{rule.baseFee} + (\text{request.weightKg} \times \text{rule.ratePerKg})\right) \times \text{rule.sizeMultiplier} + \text{destZone.baseSurcharge}$$
  - `MerchantDiscountPricingStrategy.java` (Implementation):
    Applies contracted commercial discounts (e.g. 15% discount on base fee and rate-per-kg) for corporate merchants.
  - `ExpressSameDayPricingStrategy.java` (Implementation):
    Applies expedited multiplier (1.5x) for urgent deliveries.
  - `PricingEngine.java` (Context Service): Resolves appropriate strategy bean based on customer type and tier.

### Task 1.3: Guarded Parcel Lifecycle State Machine
- **Objective:** Enforce deterministic milestone progression and block illegal status transitions.
- **Canonical Enum (`ParcelStatus`):**
  `CREATED`, `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`, `RETURNED_TO_SENDER`.
- **Allowed Transitions Matrix:**
  - `CREATED` $\rightarrow$ `ASSIGNED` (Dispatcher assigns courier) OR `PICKED_UP` (Direct courier self-pickup).
  - `ASSIGNED` $\rightarrow$ `PICKED_UP` (Courier confirms physical package collection).
  - `PICKED_UP` $\rightarrow$ `IN_TRANSIT` (Package scanned into sorting hub).
  - `IN_TRANSIT` $\rightarrow$ `OUT_FOR_DELIVERY` (Courier loads onto vehicle for final leg).
  - `OUT_FOR_DELIVERY` $\rightarrow$ `DELIVERED` (Requires recipient name and signature/photo proof).
  - `OUT_FOR_DELIVERY` $\rightarrow$ `FAILED` (Requires structured `failureReason`).
  - `FAILED` $\rightarrow$ `OUT_FOR_DELIVERY` (Re-attempt on subsequent shift).
  - `FAILED` $\rightarrow$ `RETURNED_TO_SENDER` (Exceeded 3 delivery attempts).
- **Guards & Exceptions:** Invalid transition throws `InvalidStateTransitionException` (mapped to HTTP 409 Conflict in RFC 7807 problem detail).

### Task 1.4: Customer Delivery Booking & Instant Rate Quote APIs
- **Endpoints:**
  - `POST /api/v1/parcels/quote`: Public or authenticated quote calculator.
    - Input: `originZoneId`, `destinationZoneId`, `weightKg`, `parcelSize`, optional `tier`.
    - Output: Breakdown of base fee, weight surcharge, size multiplier, zone surcharge, and final total in LKR.
  - `POST /api/v1/parcels/book`: Book delivery order (Customer or Merchant).
    - Generates unique tracking number (`SD-YYYYMMDD-XXXXXX`).
    - Calculates locked-in `estimatedFee`.
    - Creates initial `CREATED` record in `parcel_status_history`.
    - Publishes `parcel.created` event to RabbitMQ.

### Task 1.5: Public Tracking API & Digital PDF Delivery Receipt Generator
- **Endpoints:**
  - `GET /api/v1/parcels/track/{trackingNumber}`: Public unauthenticated tracking query returning current status, origin/destination zones, timestamps, and ordered status history timeline.
  - `GET /api/v1/parcels/{id}/receipt/pdf`: Generates on-the-fly downloadable PDF receipt for delivered parcels using `openpdf` / `iText`, including sender, recipient, weight, fee, tracking code, barcode, and delivery timestamp.

### Task 1.6: Dispatcher Unassigned Queue & Courier Workload Balancer
- **Endpoints:**
  - `GET /api/v1/parcels/unassigned`: Retrieves all parcels with status `CREATED` filtered by origin zone.
  - `PUT /api/v1/parcels/{parcelId}/assign`: Assigns parcel to courier.
    - Validates courier capacity (ensures active parcels $< 20$).
    - Updates `parcels.assigned_courier_id` and advances status to `ASSIGNED`.
    - Publishes `parcel.assigned` event to RabbitMQ.

### Task 1.7: Courier Runsheet & In-Shift Delivery Execution APIs
- **Endpoints:**
  - `GET /api/v1/parcels/courier/runsheet`: Retrieves all parcels assigned to the authenticated courier (`X-Courier-Id` / `X-User-Id`), grouped into Pickups and Deliveries.
  - `PATCH /api/v1/parcels/{id}/status`: Advances status.
    - **Security Rule:** Enforces that `parcel.assignedCourierId == authenticatedUser.getCourierId()`. Unauthorized attempt throws `AccessDeniedException` (HTTP 403).
    - If status = `FAILED`: Requires non-blank `failureReason`.
    - If status = `DELIVERED`: Requires `recipientSignatureName` and proof URL.
    - Publishes `parcel.status.updated` to RabbitMQ and broadcasts to STOMP topic.

### Task 1.8: Local File Upload & Storage for Delivery Proofs
- **Objective:** Support live photo upload without non-existent cloud storage dependencies.
- **Endpoints:**
  - `POST /api/v1/parcels/{id}/proof-upload`: Consumes `multipart/form-data` (file or canvas signature PNG).
    - Saves image to mounted volume directory `/app/uploads/proofs/`.
    - Generates local serving URL: `/api/v1/parcels/proofs/{filename}`.
  - `GET /api/v1/parcels/proofs/{filename}`: Static resource handler serving uploaded proof images.

### Task 1.9: Admin Delivery Zones & Pricing Rule CRUD Management APIs
- **Endpoints (Protected by `ROLE_ADMIN`):**
  - `GET /api/v1/zones`, `POST /api/v1/zones`, `PUT /api/v1/zones/{id}`: Manage delivery districts and surcharges.
  - `GET /api/v1/pricing/rules`, `POST /api/v1/pricing/rules`, `PUT /api/v1/pricing/rules/{id}`: Manage inter-zone pricing matrix.

### Task 1.10: Admin Operational Analytics & Daily Reports API
- **Endpoint:** `GET /api/v1/parcels/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Calculates: Total bookings, Delivered count, Failed count, Success rate percentage, Average delivery duration, Deliveries per day time-series data.

### Task 1.11: Real-Time STOMP over SockJS WebSockets
- **Configuration:** Spring WebSocket config on path `/ws-swiftdrop`.
- **Broadcasting:** When parcel status changes, publish JSON to:
  `"/topic/parcels/" + parcel.getTrackingNumber()`

### Task 1.12: Customer & Merchant Paginated Order History & Dashboard APIs
- **Objective:** Power the Customer Delivery History view and the Merchant Order Dashboard.
- **Endpoints:**
  - `GET /api/v1/parcels/customer/orders`: Returns paginated shipments where `sender_user_id = X-User-Id`, with optional status filtering (`status=IN_TRANSIT`), sorting by `createdAt` DESC.
  - `GET /api/v1/parcels/merchant/orders`: Returns paginated shipments where `merchant_id = X-Merchant-Id`, with full status summary counts (`total`, `created`, `inTransit`, `delivered`, `failed`).

### Task 1.13: B2B Merchant Automated Order Creation & Bulk Ingestion
- **Objective:** Support both single M2M API order creation (via OAuth 2.0 Client Credentials token) and portal CSV/JSON batch order creation.
- **Endpoints:**
  - `POST /api/v1/parcels/merchant/orders`: Single M2M order creation. Extracts `X-Merchant-Id` from Gateway header, applies `MerchantDiscountPricingStrategy`, generates tracking number, persists, and emits `parcel.created`.
  - `POST /api/v1/parcels/bulk`: Bulk batch order creation. Accepts array of up to 100 delivery requests in a single transaction. Returns array of `{ trackingNumber, estimatedFee, status, errors }`.

---

## 3. Module 2: `services/auth-service` (Internal & Self-Service Extensions)
**Service Port:** `8081` | **Database:** `auth_db`

### Task 2.1: Internal Merchant Webhook Configuration API
- **Objective:** Provide a secure internal REST endpoint allowing `notification-webhook-service` to retrieve merchant webhook secrets without cross-database access.
- **Endpoint:** `GET /api/v1/auth/internal/merchants/{merchantId}/webhook-config`
  - Returns `MerchantWebhookConfigResponse(UUID merchantId, String webhookUrl, String webhookSecret, Boolean isActive)`.
  - Protected by API Gateway blocking external callers (`/api/v1/auth/internal/**`).

### Task 2.2: Courier Workload Synchronization Consumer
- **Objective:** Keep `auth_db.couriers.active_delivery_count` accurate in real time.
- **Implementation:** RabbitMQ listener in `auth-service` bound to `swiftdrop.events.topic`:
  - Listens to `parcel.assigned`: Atomically increments `active_delivery_count` by 1.
  - Listens to `parcel.status.delivered` and `parcel.status.failed`: Atomically decrements `active_delivery_count` by 1.

### Task 2.3: Machine-to-Machine (M2M) OAuth 2.0 Client Credentials Grant
- **Endpoint:** `POST /api/v1/auth/oauth/token`
  - Accepts `grant_type=client_credentials`, `client_id`, `client_secret`.
  - Verifies hashed secret in `auth_db.merchants`.
  - Returns Bearer JWT with claims `role=ROLE_MERCHANT`, `merchantId={uuid}`.

### Task 2.4: Merchant Self-Service Credentials & Webhook Configuration Management
- **Objective:** Allow approved merchants logged into the Merchant Portal to configure their webhook endpoint and manage API credentials.
- **Endpoints (Protected by `ROLE_MERCHANT`):**
  - `GET /api/v1/auth/merchant/profile`: Returns `businessName`, `registrationNumber`, `oauthClientId`, `webhookUrl`, and masked `webhookSecret` (`whsec_****`).
  - `PUT /api/v1/auth/merchant/webhook`: Updates `webhookUrl` and optionally regenerates `webhookSecret`.
  - `POST /api/v1/auth/merchant/credentials/rotate`: Generates new `oauthClientSecret`, hashes and stores in `merchants.oauth_client_secret_hash`, and returns the raw secret once to the user.

### Task 2.5: Courier Self-Service Profile & Shift Availability Toggle
- **Objective:** Allow couriers to toggle whether they are on-duty (`is_available`) and propagate courier identifiers cleanly.
- **Endpoints (Protected by `ROLE_COURIER`):**
  - `GET /api/v1/auth/courier/profile`: Returns `vehicleType`, `licensePlate`, `isAvailable`, `activeDeliveryCount`, and `assignedZoneId`.
  - `PATCH /api/v1/auth/courier/availability`: Toggles `is_available = true/false` and optionally updates current operating zone.
- **Claim Enrichment Enhancement:**
  - Update `JwtTokenProvider.java`: When authenticating a Courier or Merchant, embed `courierId` or `merchantId` directly inside JWT claims:
    `claims.put("courierId", courier.getId())` / `claims.put("merchantId", merchant.getId())`.

---

## 4. Module 3: `services/notification-webhook-service` (Event Messaging & Outbound Webhooks)
**Service Port:** `8083` | **Database:** `notification_db`

### Task 3.1: RabbitMQ Topic Exchange Consumer
- **Configuration:** Declare queue `notification.parcel.events` bound to topic exchange `swiftdrop.events.topic` with routing key `parcel.*`.
- Multi-threaded consumer parsing incoming `ParcelStatusUpdatedEvent`.

### Task 3.2: Multi-Channel Customer Notification Dispatchers
- **Email Dispatcher:** Thymeleaf HTML templates for:
  - `parcel-booked.html`: Sent on booking confirmation.
  - `out-for-delivery.html`: Sent with courier contact details.
  - `delivery-success.html`: Sent with digital delivery receipt link.
- **Mock SMS Service:**
  - `MockSmsSender.java`: Emits structured SMS logs with recipient mobile, message body, and mock gateway response ID.

### Task 3.3: Enterprise Merchant Webhook Engine with HMAC-SHA256
- When `event.getMerchantId() != null`:
  - Call `auth-service` internal API (`Task 2.1`) to get `webhookUrl` and `webhookSecret` (cached using Caffeine/Spring Cache for 15 minutes).
  - Compute `X-SwiftDrop-Signature: sha256={HMAC-SHA256(payload, secret)}`.
  - Dispatch HTTP POST to merchant `webhookUrl` with a 5-second connect/read timeout.

### Task 3.4: Dead-Letter Queue (DLQ) Exponential Backoff Retries
- When webhook dispatch fails (HTTP 5xx or timeout):
  - Log failure in `notification_db.webhook_delivery_logs`.
  - Route to Dead-Letter Exchange `swiftdrop.dlx` with TTL backoff headers:
    - Attempt 1: 10 seconds.
    - Attempt 2: 30 seconds.
    - Attempt 3: 2 minutes.
    - Attempt 4: 10 minutes.
    - Attempt 5: 30 minutes.
  - If retry count $\ge 5$, mark status as `DEAD_LETTER` for audit review.

### Task 3.5: Built-In Demo Webhook Receiver Endpoint (For Examiner Demo)
- **Objective:** Provide a guaranteed live target for the examiner demo without external webhook testing tools.
- **Endpoint:** `POST /api/v1/webhooks/demo-receiver`
  - Receives merchant webhook payload and `X-SwiftDrop-Signature`.
  - Verifies HMAC cryptographic signature against demo secret.
  - Stores incoming payload in in-memory event store exposed to Next.js Merchant Dashboard via Server-Sent Events (SSE) or polling.

### Task 3.6: Webhook Delivery Logs Query API (For Merchant & Admin Portal)
- **Objective:** Let Merchants and Admins inspect outbound webhook delivery attempts, HTTP status codes, and retry/dead-letter states in the UI.
- **Endpoints:**
  - `GET /api/v1/webhooks/logs`: Paginated query returning `webhook_delivery_logs` filtered by `merchantId` (or all logs if `ROLE_ADMIN`), showing `eventType`, `httpStatusCode`, `retryCount`, `deliveryStatus` (`DELIVERED`, `RETRYING`, `DEAD_LETTER`), and `nextRetryAt`.
  - `POST /api/v1/webhooks/logs/{id}/retry`: Manual "Retry Webhook Now" action for failed/dead-letter logs.

---

## 5. Module 4: `services/api-gateway` (Perimeter Routing & Security Expansion)
**Service Port:** `8080`

### Task 4.1: Downstream Route Definitions
Update `application.yml` route predicates and filters:
- `/api/v1/parcels/**` $\rightarrow$ `http://localhost:8082` (or K8s service `parcel-service`).
- `/api/v1/zones/**`, `/api/v1/pricing/**` $\rightarrow$ `http://localhost:8082`.
- `/api/v1/webhooks/**` $\rightarrow$ `http://localhost:8083`.
- `/api/v1/ai/**` $\rightarrow$ `http://localhost:8084`.
- `/ws-swiftdrop/**` $\rightarrow$ `ws://localhost:8082` (WebSocket upgrade).

### Task 4.2: Perimeter RBAC Matrix Expansion
Update `RoleAuthorizationFilter.java`:
- `/api/v1/parcels/courier/**`, `/api/v1/auth/courier/**` requires `ROLE_COURIER`.
- `/api/v1/parcels/merchant/**`, `/api/v1/auth/merchant/**` requires `ROLE_MERCHANT`.
- `/api/v1/parcels/unassigned`, `/api/v1/parcels/{id}/assign` requires `ROLE_ADMIN`.
- `/api/v1/zones/**`, `/api/v1/pricing/**`, `/api/v1/parcels/reports/**` requires `ROLE_ADMIN`.
- Public routes updated in `RouteValidator.java`: `/api/v1/parcels/track/**`, `/api/v1/parcels/quote`, `/api/v1/webhooks/demo-receiver`.

### Task 4.3: Claim Enrichment & Internal Endpoint Perimeter Protection
- **Claim Enrichment:** Update `AuthenticationFilter.java` to extract `courierId` and `merchantId` claims from the verified JWT and inject them into downstream headers:
  - `X-Courier-Id: {courierId}`
  - `X-Merchant-Id: {merchantId}`
- **Internal Route Guard:** In `RouteValidator.java`, flag any path matching `/api/v1/auth/internal/**` or `/api/v1/parcels/internal/**` as strictly blocked for public incoming traffic from the outside internet (returns HTTP 403 Forbidden).

### Task 4.4: WebSocket Perimeter Handshake & Upgrade Passthrough
- Configure Spring Cloud Gateway route for `/ws-swiftdrop/**` supporting HTTP `Upgrade: websocket` and `Connection: Upgrade` headers without stripping SockJS handshake parameters.

---

## 6. Module 5: `services/ai-assistant-service` (Generative AI & MCP Tools - Bonus +5)
**Service Port:** `8084`

### Task 5.1: Spring AI Framework & LLM Client Bootstrap
- Integrate Spring AI framework (`spring-ai-openai` or `spring-ai-ollama`).
- Configure system prompt with Sri Lankan delivery rules, company policies, and courteous assistant persona.

### Task 5.2: Model Context Protocol (MCP) Tool Calling
- Implement Java functions registered as Spring AI tools:
  1. `get_parcel_status(String trackingNumber)`: Calls `parcel-service` tracking API.
  2. `calculate_rate_quote(Double weightKg, String originCity, String destCity, String parcelSize)`: Calls `parcel-service` quote API.

### Task 5.3: Conversational REST Chat Endpoint
- `POST /api/v1/ai/chat`: Accepts `{ "message": "...", "conversationId": "..." }`, returns `{ "reply": "...", "toolExecuted": "get_parcel_status" }`.

### Task 5.4: Standardized Model Context Protocol (MCP) Server Exposure & Deterministic Fallback
- **MCP Server:** Expose `get_parcel_status` and `calculate_rate_quote` via the official Spring AI Model Context Protocol (MCP) Server specification (SSE / Stdio transport) to earn the full +5 bonus marks.
- **Deterministic Offline Fallback:** If an external LLM API key rate-limits or lacks internet connectivity during the examiner grading demo, provide an automated local regex/rule-based intent parser fallback so the demo continues smoothly without crashing.

---

## 7. Module 6: `frontend/` (Next.js 14+ Responsive Web Applications)

### Task 6.0: Shared Frontend Architecture, Auth Interceptor & Role Guard Middleware
- **Centralized API Client (`lib/api.ts`):**
  - Axios instance with request interceptor automatically attaching `Authorization: Bearer <accessToken>`.
  - Response interceptor catching HTTP 401: Queues failed requests, calls `/api/v1/auth/refresh` with `refreshToken`, updates in-memory token, and replays failed requests transparently.
- **Next.js Route Protection Middleware (`middleware.ts`):**
  - Enforces RBAC route boundaries:
    - `/customer/**` requires `ROLE_CUSTOMER`.
    - `/merchant/**` requires `ROLE_MERCHANT`.
    - `/courier/**` requires `ROLE_COURIER`.
    - `/admin/**` requires `ROLE_ADMIN`.
- **Account Lifecycle Holding Screens:**
  - `/pending-approval`: Friendly screen for couriers and merchants awaiting admin review.
  - `/rejected`: Clear notice displaying the admin's rejection reason (`statusReason`).
  - `/suspended`: Notice alerting user that their account was suspended.
- **Shared App Shell (`components/layout/`):**
  - Responsive Sidebar, Top Navbar with user profile avatar, Logout button, and global Toast notification system.

### Task 6.1: Public Landing Page & Mobile-Friendly Tracking Portal
- Landing page with hero banner, service overview, and instant tracking search bar.
- Dynamic route `/track/[trackingNumber]`: Visual horizontal/vertical milestone stepper showing vehicle location progression and proof photo.

### Task 6.2: Customer Portal
- 4-Step Booking Wizard:
  - Step 1: Sender & Receiver Addresses.
  - Step 2: Weight, dimensions, and parcel category.
  - Step 3: Dynamic fee quote preview with breakdown.
  - Step 4: Booking confirmation & printable tracking label.
- Live Tracking Screen: Subscribes to STOMP WebSocket `/topic/parcels/{trackingNumber}` for live DOM updates without refresh.
- Shipment History: Paginated table of past parcels with "Download PDF Receipt" action button.

### Task 6.3: Courier Mobile-Responsive Web Application
- Runsheet Screen: Touch-friendly card list of assigned packages sorted by priority.
- Shift Availability Switch: Header toggle for `is_available = true/false` calling `PATCH /api/v1/auth/courier/availability`.
- Status Update Modal: Big buttons for `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`.
- HTML5 Canvas Signature Pad: Recipient draws digital signature on touch screen.
- Camera Capture / Upload: Driver snaps photo of package at doorstep.

### Task 6.4: Dispatcher & Admin Console
- Partner Review Queue: Review pending merchants & couriers with Approve, Reject (reason), and Suspend actions.
- Unassigned Parcels Board: List of `CREATED` parcels with one-click courier assignment dropdown showing active workload counter (e.g. `Kamal (5/20 parcels)`).
- Delivery Zones & Pricing Rules Table: Edit base fees, surcharges, and rate-per-kg multipliers.
- Operations Analytics Dashboard: Recharts / Chart.js graphs displaying daily delivery volume, success rate, and failure breakdowns.

### Task 6.5: Merchant B2B Portal
- Dashboard: Order volume, delivery success rate, and active parcel grid.
- Bulk Upload: CSV / JSON file parser submitting orders in batches to `POST /api/v1/parcels/bulk`.
- Webhook Management: Form to set webhook URL, generate/rotate secret, and live stream of incoming webhook events from the demo receiver.

### Task 6.6: Floating AI Delivery Assistant Chat Widget
- Component `components/AiDeliveryAssistantWidget.tsx`: Floating chat bubble at bottom right of public landing and customer pages, providing instant tracking queries and fee quotes.

---

## 8. Module 7: DevOps, Containerization & Kubernetes (Bonus +5)

### Task 7.1: Multi-Stage Production Dockerfiles
- Dockerfile for each microservice (`api-gateway`, `auth-service`, `parcel-service`, `notification-webhook-service`, `ai-assistant-service`) using `eclipse-temurin:21-jdk` build stage and `eclipse-temurin:21-jre-alpine` runtime stage.
- Dockerfile for Next.js frontend with standalone output optimization.

### Task 7.2: Root Docker Compose Orchestration
- Update `docker-compose.yml` to launch:
  - `postgres` (Port 5432, 3 logical databases)
  - `rabbitmq` (Ports 5672 and 15672 Management UI)
  - 5 Spring Boot microservices (Ports 8080, 8081, 8082, 8083, 8084)
  - Next.js frontend (Port 3000)
  - Shared uploads volume for proof photos (`swiftdrop-uploads:/app/uploads`)

### Task 7.3: Kubernetes Production Manifests (`k8s/` - Bonus Marks +5)
- Author complete Kubernetes descriptors:
  - `namespace.yaml`: `swiftdrop`.
  - `configmaps.yaml` & `secrets.yaml`: Database credentials, RabbitMQ URI, JWT secret.
  - `postgres-statefulset.yaml` & `rabbitmq-statefulset.yaml`: PersistentVolumeClaims.
  - `deployments/` & `services/` for each microservice with readiness/liveness probes (`/actuator/health`).
  - `ingress.yaml`: NGINX Ingress Controller routing rules.
  - `hpa.yaml`: Horizontal Pod Autoscalers based on CPU thresholds.

### Task 7.4: Production Helm Chart Package
- Package `charts/swiftdrop/`: `Chart.yaml`, `values.yaml`, templates for deployments, services, ingress, and configmaps.

### Task 7.5: Live Kubernetes Cluster Deployment & Smoke Verification
- Objective: Verify deployment on local/cloud cluster (Minikube / Kind / Docker Desktop K8s / Cloud VM).
- Run and document verification script:
  `kubectl get pods -n swiftdrop` (all pods `Running`), `kubectl get ingress -n swiftdrop`, smoke test through Ingress host.

---

## 9. Module 8: Quality Assurance, JaCoCo Coverage & Testing (15 Marks)

### Task 8.1: JaCoCo Code Coverage Maven Plugin Setup
- Configure `jacoco-maven-plugin` across all microservice POMs.
- Enforce automated build failure if line or branch coverage falls below **80%**:
  `mvn clean verify` produces HTML report in `target/site/jacoco/index.html`.

### Task 8.2: Role Authorization Security Tests
- Integration tests in `parcel-service` verifying:
  - Courier A cannot view or update Courier B's parcel (HTTP 403).
  - Merchant A cannot inspect Merchant B's orders (HTTP 403).
  - Customer cannot trigger dispatcher assignment (HTTP 403).

### Task 8.3: Event-Driven Integration Flow Tests with RabbitMQ Testcontainers
- Implement `ParcelDeliveryIntegrationTest.java`:
  - Starts ephemeral RabbitMQ container via Testcontainers.
  - Triggers parcel status update in `parcel-service`.
  - Asserts message consumption in `notification-webhook-service`.
  - Verifies webhook dispatch attempt and delivery log creation.

### Task 8.4: Automated Postman Collection & Newman CI Regression Suite
- Export comprehensive Postman collection: `tests/postman/swiftdrop-collection.json`.
- Add Newman CLI execution step to `.github/workflows/ci.yml`.

### Task 8.5: Consolidated Test Execution & Coverage Summary Document
- Script/document that aggregates test execution counts and JaCoCo coverage reports across `api-gateway`, `auth-service`, `parcel-service`, `notification-webhook-service`, and `ai-assistant-service` into a single **Test & Coverage Summary Report (PDF/Markdown)** for academic submission.

---

## 10. Module 9: Cross-Cutting Concerns & Security Guardrails

### Task 10.1: PII Masking Utility (`PiiMaskingUtil`) in SLF4J Loggers
- Implement `PiiMaskingUtil.java` across all backend services:
  - Masks phone numbers: `+94771234567` $\rightarrow$ `+94*****4567`.
  - Masks emails: `kamal@gmail.com` $\rightarrow$ `k***l@gmail.com`.
  - Masks addresses: Replaces street numbers with asterisks in log outputs.

### Task 10.2: RFC 7807 Global Exception Handling
- Implement `@RestControllerAdvice` in all new services (`parcel-service`, `notification-webhook-service`, `ai-assistant-service`) mapping domain errors to RFC 7807 `ProblemDetail` payloads.

---
