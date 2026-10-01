# MFE Formwork MR11 System - System Architecture & Flow Diagrams

This document outlines the end-to-end workflows, system architecture, data reconciliation pipelines, and role-based operational flows for the **MFE Formwork MR11 System**.

---

## 1. High-Level System Architecture

The MFE Formwork MR11 system integrates a high-performance Express backend with a React 19 single-page application (SPA), orchestrating multi-departmental manufacturing schedules, color-coded series tracking, and executive dashboards.

```mermaid
graph TB
    subgraph ClientLayer ["Frontend Client (React 19 + Tailwind CSS)"]
        UI_Login["Login & Auth Guard"]
        UI_MR11["MR11 Master Schedule Table"]
        UI_CEO["CEO Executive Dashboard & Analytics"]
        UI_Dept["Department Spreadsheet Workspaces<br/>(BD, Finance, Shellplan, Design, Planning, Production, Dispatch)"]
        UI_Series["Planning & Production Series Trackers"]
        UI_Admin["Admin Console (Users, RBAC, Column Config)"]
    end

    subgraph GatewayLayer ["Fullstack Entry & Express Router (Port 3000)"]
        ServerEntry["server.ts (Node / TSX)"]
        ViteDev["Vite Dev Middleware (SPA Transpilation)"]
        ExpressApp["Express App (server/app.ts)"]
        AuthMiddleware["JWT requireAuth & requireRole Middleware"]
    end

    subgraph ServiceLayer ["Backend Domain Modules"]
        AuthMod["Auth Service (/api/auth)"]
        DeptMod["Department Service (/api/departments)"]
        MR11Mod["MR11 Master Engine (/api/mr11)"]
        AdminMod["Admin & Audit Service (/api/admin)"]
        VizMod["Visualization Service (/api/visualization)"]
    end

    subgraph CoreEngine ["MR11 Processing & Analytical Engines"]
        ExcelParser["ExcelJS Style-Aware Parser<br/>(Extracts Values, Font Colors & Fills)"]
        SeriesEngine["Series Tracker & Color Matcher Engine"]
        Consolidator["Multi-Department Reconciliation Pipeline"]
        SnapshotManager["MR11 Run Snapshot Generator"]
    end

    subgraph DataLayer ["Persistence & Storage"]
        PrismaClient["Prisma Client (In-Memory / Postgres)"]
        FileStorage["Uploads Storage System (XLSX Files)"]
    end

    UI_Login --> ExpressApp
    UI_MR11 --> ExpressApp
    UI_CEO --> ExpressApp
    UI_Dept --> ExpressApp
    UI_Series --> ExpressApp
    UI_Admin --> ExpressApp

    ServerEntry --> ViteDev
    ServerEntry --> ExpressApp
    ExpressApp --> AuthMiddleware
    AuthMiddleware --> ServiceLayer

    DeptMod --> ExcelParser
    DeptMod --> SeriesEngine
    ExcelParser --> FileStorage
    SeriesEngine --> PrismaClient

    MR11Mod --> Consolidator
    Consolidator --> SeriesEngine
    Consolidator --> SnapshotManager
    SnapshotManager --> PrismaClient
```

---

## 2. End-to-End User Authentication & RBAC Flow

Access control ensures that users can view and edit data according to their assigned corporate roles.

```mermaid
sequenceDiagram
    autonumber
    actor User as Department User / Admin / CEO
    participant Client as Frontend (Login UI / AuthStore)
    participant AuthAPI as Auth Controller (/api/auth/login)
    participant DB as Prisma Store
    participant Router as Protected Routes & Middleware

    User->>Client: Enters Email & Password
    Client->>AuthAPI: POST /api/auth/login { email, password }
    AuthAPI->>DB: prisma.user.findFirst(email, include roles)
    DB-->>AuthAPI: User record + Role IDs
    AuthAPI->>AuthAPI: Verify PBKDF2 Password Hash
    alt Password Valid
        AuthAPI->>AuthAPI: Sign JWT with User ID, Email, Role Codes
        AuthAPI-->>Client: 200 OK { token, user: { id, email, roles } }
        Client->>Client: Save token to localStorage & Zustand AuthStore
        Client->>Router: Navigate to /mr11 (or /departments/:code)
    else Invalid Credentials
        AuthAPI-->>Client: 401 Unauthorized { error: 'Invalid email or password' }
        Client-->>User: Display authentication error toast
    end

    Note over Client,Router: Subsequent Authorized Requests
    Client->>Router: GET /api/departments (Header: Bearer JWT)
    Router->>Router: requireAuth() verifies JWT signature & expiry
    Router->>DB: Query department active records
    DB-->>Router: Department list
    Router-->>Client: 200 OK { success: true, data: [...] }
```

---

## 3. Department Workbook Upload & Parsing Pipeline

When a department officer uploads their latest spreadsheet, the system parses cell values, formatting, and detects plant/series color codes atomically.

```mermaid
flowchart TD
    StartUpload([Officer Uploads .xlsx Workbook]) --> ReceiveFile[Express Multer Middleware Saves Temp File]
    ReceiveFile --> VerifyRole{User has Role for Department or ADMIN?}

    VerifyRole -- No --> RejectUpload[Return 403 Forbidden]
    VerifyRole -- Yes --> ReadExcel[ExcelJS Reads File Buffer]

    ReadExcel --> ExtractStyles[Style Extractor: Read Fill Colors, Font Colors, Formatted Dates]
    ExtractStyles --> SheetToFortune[Convert ExcelJS Sheets to FortuneSheet JSON Structure]

    SheetToFortune --> CheckDept{Department Type}

    CheckDept -- "PLANNING" --> DetectPlanSeries[Scan Columns for Font Color & Series Numbers]
    DetectPlanSeries --> SavePlanSeries[Upsert PlanningSeriesHistory & PlanningProjectQuantityTracker]

    CheckDept -- "PRODUCTION" --> DetectProdSeries[Scan Columns for Font Color & Series Numbers]
    DetectProdSeries --> SaveProdSeries[Upsert ProductionSeriesHistory]

    CheckDept -- "BD / FINANCE / SHELLPLAN / DESIGN / DISPATCH" --> GenericSave[Validate Key Project Identifiers]

    SavePlanSeries --> CreateFileVersion[Prisma: Create FileVersion Record]
    SaveProdSeries --> CreateFileVersion
    GenericSave --> CreateFileVersion

    CreateFileVersion --> SetActiveVersion[Prisma: Update Department.activeVersionId]
    SetActiveVersion --> LogAudit[Log Audit Action: UPLOAD_WORKBOOK]
    LogAudit --> TriggerMR11[Trigger executeMr11Pipeline Background Job]
    TriggerMR11 --> SuccessResponse([Return 200 OK & Active Version Metadata])
```

---

## 4. The MR11 Multi-Department Reconciliation Engine

The MR11 Master Consolidation Engine reconciles data from all 7 operational departments into a single coherent master record for every project.

```mermaid
flowchart TD
    subgraph Ingestion ["Stage 1: Dataset Ingestion"]
        BD_Data["1. Business Development (BD)<br/>Primary Master: Projects, Areas, Delivery Dates, Font Colors"]
        FIN_Data["2. Finance<br/>Payment Terms, Advance %, LC Received"]
        SP_Data["3. Shellplan<br/>Consultant Drawing Status, Approval Dates"]
        DES_Data["4. Design<br/>Design Release Dates, Engineered Quantities"]
        PLAN_Data["5. Planning<br/>Processed Square Meters, Cutting/Welding Series"]
        PROD_Data["6. Production<br/>Fabrication Output, Stage Completion"]
        DISP_Data["7. Dispatch<br/>Packing, Shipping, Port & Delivery Dates"]
    end

    subgraph Normalization ["Stage 2: Key Matching & Alignment"]
        CleanKeys["Normalize Project Keys<br/>(Strip spaces, lowercase, clean project numbers)"]
        StreamMatch["Align Streams (Stream 1, Stream 2, Stream 3)"]
        ColorMatch["Normalize Font Colors<br/>(Black, Red, Blue, Green, Purple - Denotes Plant/Priority)"]
    end

    subgraph SeriesAggregation ["Stage 3: Series History Aggregation"]
        PlanAgg["Aggregate Planning Series History for matched Project + FontColor + Stream"]
        ProdAgg["Aggregate Production Series History for matched Project + FontColor + Stream"]
        QtyTracker["Query PlanningProjectQuantityTracker for target vs processed m2"]
    end

    subgraph MergingLogic ["Stage 4: Cross-Department Record Merging"]
        BaseRow["Seed Base MR11 Row from BD Record"]
        MergeFin["Join Finance Fields (Advance %, LC Status)"]
        MergeSP["Join Shellplan Fields (Latest Approval Date, Revision)"]
        MergeDes["Join Design Fields (Design Approval Date, Approved m2)"]
        MergePlan["Join Planning Series Totals & Processing Stages"]
        MergeProd["Join Production Fabricated Totals & Finish Dates"]
        MergeDisp["Join Dispatch Sailing Dates, Container Nos, Delivery"]
    end

    subgraph Derivations ["Stage 5: Calculated KPIs & Status Flags"]
        CalcDelta["Calculate Delivery vs Production Lead Delta (Days)"]
        CalcBalance["Calculate Balance Quantities (Contract m2 - Processed m2)"]
        CalcStatus["Evaluate Status Badges (On Track, Delayed, Pending Approval)"]
    end

    subgraph Finalization ["Stage 6: Master Snapshot Creation"]
        Snapshot["Construct MR11Run Record"]
        SaveDB["Prisma: Save MR11Run (Status: READY, RecordCount, JSON records)"]
        EmitEvent["Notify Clients & Invalidate MR11 Cache"]
    end

    BD_Data --> CleanKeys
    FIN_Data --> CleanKeys
    SP_Data --> CleanKeys
    DES_Data --> CleanKeys
    PLAN_Data --> CleanKeys
    PROD_Data --> CleanKeys
    DISP_Data --> CleanKeys

    CleanKeys --> StreamMatch
    StreamMatch --> ColorMatch

    ColorMatch --> PlanAgg
    ColorMatch --> ProdAgg
    ColorMatch --> QtyTracker

    PlanAgg --> BaseRow
    ProdAgg --> BaseRow
    QtyTracker --> BaseRow

    BaseRow --> MergeFin
    MergeFin --> MergeSP
    MergeSP --> MergeDes
    MergeDes --> MergePlan
    MergePlan --> MergeProd
    MergeProd --> MergeDisp

    MergeDisp --> CalcDelta
    CalcDelta --> CalcBalance
    CalcBalance --> CalcStatus

    CalcStatus --> Snapshot
    Snapshot --> SaveDB
    SaveDB --> EmitEvent
```

---

## 5. Planning vs. Production Series Tracking State Machine

The system tracks dynamic series additions across multiple file uploads, preserving historical runs even if subsequent uploads only contain new series.

```mermaid
stateDiagram-v2
    [*] --> NewUploadDetected: Officer uploads Planning or Production XLSX

    state NewUploadDetected {
        [*] --> ParseColumns
        ParseColumns --> DetectSeriesHeader: Header matches Series pattern (e.g. S1, S2, Series 1)
        DetectSeriesHeader --> InspectFontColor: Extract cell font color & fill
        InspectFontColor --> ExtractMetrics: Read Total Processed / Fabricated (m2)
    }

    NewUploadDetected --> HistoricalComparison: Match with existing Series History in DB

    state HistoricalComparison {
        [*] --> CheckExistingSeries
        CheckExistingSeries --> UpdateSeriesRecord: Series Number + Project + Stream + Color exists
        CheckExistingSeries --> InsertNewSeries: New Series detected
    }

    HistoricalComparison --> QuantityTrackerSync: Synchronize Project Level Quantity Trackers

    state QuantityTrackerSync {
        [*] --> SumAllSeries: Sum total m2 across all detected series
        SumAllSeries --> ComputeBalance: Calculate Balance = Target Quantity - Total Processed
        ComputeBalance --> UpdateTracker: Store updated total and timestamp
    }

    QuantityTrackerSync --> [*]: Series History Available for MR11 Engine
```

---

## 6. Executive & CEO Dashboard Analytical Data Flow

The CEO Dashboard consumes pre-aggregated metrics and real-time MR11 runs to provide high-level visibility.

```mermaid
sequenceDiagram
    autonumber
    actor Executive as CEO / Executive User
    participant Frontend as CeoDashboard (React Component)
    participant VizAPI as Visualization Controller (/api/visualization)
    participant MR11Service as MR11 Engine / Store
    participant DB as Prisma Store

    Executive->>Frontend: Navigates to /ceo
    Frontend->>VizAPI: GET /api/visualization/summary (Bearer Token)
    VizAPI->>MR11Service: Fetch latest MR11Run (Status: READY)
    MR11Service->>DB: prisma.mr11Run.findFirst(orderBy: generatedAt desc)
    DB-->>MR11Service: Latest master records
    
    VizAPI->>DB: prisma.planningProjectQuantityTracker.findMany()
    DB-->>VizAPI: Target vs Processed quantities

    VizAPI->>DB: prisma.department.findMany(include activeVersion)
    DB-->>VizAPI: Department upload health and timestamps

    VizAPI->>VizAPI: Aggregate KPIs:
    Note over VizAPI: - Total Contract Volume (m2)<br/>- Total Processed Volume (m2)<br/>- Production vs Planning Velocity<br/>- Projects at Risk (Delayed Delivers)<br/>- Department Data Freshness Index

    VizAPI-->>Frontend: 200 OK { kpis, departmentHealth, projectPipelines, monthlyTrend }
    Frontend->>Frontend: Render Chart.js Bar & Line Graphs, Milestone Deck, Progress Gauges
    Frontend-->>Executive: Displays interactive executive dashboard
```

---

## 7. Role Permissions Matrix

| Module / Route | ADMIN | CEO | BD | FINANCE | SHELLPLAN | DESIGN | PLANNING | PRODUCTION | DISPATCH |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **MR11 Master Schedule** (`/mr11`) | Read/Write | Read-Only | Read-Only | Read-Only | Read-Only | Read-Only | Read-Only | Read-Only | Read-Only |
| **CEO Dashboard** (`/ceo`) | Full Access | Full Access | No | No | No | No | No | No | No |
| **BD Department** (`/departments/BD`) | Full Access | Read-Only | Upload/View | No | No | No | No | No | No |
| **Finance Department** (`/departments/FINANCE`) | Full Access | Read-Only | No | Upload/View | No | No | No | No | No |
| **Shellplan Department** (`/departments/SHELLPLAN`) | Full Access | Read-Only | No | No | Upload/View | No | No | No | No |
| **Design Department** (`/departments/DESIGN`) | Full Access | Read-Only | No | No | No | Upload/View | No | No | No |
| **Planning Department** (`/departments/PLANNING`) | Full Access | Read-Only | No | No | No | No | Upload/View | No | No |
| **Production Department** (`/departments/PRODUCTION`)| Full Access | Read-Only | No | No | No | No | No | Upload/View | No |
| **Dispatch Department** (`/departments/DISPATCH`) | Full Access | Read-Only | No | No | No | No | No | No | Upload/View |
| **Admin Console** (`/admin`) | Full Access | No | No | No | No | No | No | No | No |
| **Trigger Master MR11 Run** | Yes | No | Yes (via upload)| Yes (via upload)| Yes (via upload)| Yes (via upload)| Yes (via upload)| Yes (via upload)| Yes (via upload)|
