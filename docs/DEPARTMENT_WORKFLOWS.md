# Department Data Workflows & Field Mapping Guide

This document explains the data responsibility, column specifications, font color significance, and integration rules for each of the 7 operational departments contributing to the **MFE Formwork MR11 Master System**.

---

## 1. Department Overview & Information Flow

```mermaid
graph LR
    BD["1. BD<br/>Contract & Project Master"] -->|Seeds Projects & Area| MR11Master((MR11 Master Schedule))
    FIN["2. Finance<br/>Advances & Commercials"] -->|Advance % & LC| MR11Master
    SP["3. Shellplan<br/>Consultant Approvals"] -->|Approval Dates| MR11Master
    DES["4. Design<br/>Engineering Releases"] -->|Approved m2 & Date| MR11Master
    PLAN["5. Planning<br/>Series & Cutting Stages"] -->|Processed m2| MR11Master
    PROD["6. Production<br/>Fabrication Output"] -->|Fabricated m2| MR11Master
    DISP["7. Dispatch<br/>Logistics & Sailing"] -->|Containers & Delivery| MR11Master

    MR11Master --> CEO["CEO Executive Analytics"]
    MR11Master --> Export["Master Excel Export (.xlsx)"]
```

---

## 2. Business Development (BD) - Primary Seed Master

The BD workbook is the foundational driver of the entire MR11 pipeline. Every project represented in MR11 must originate from or match against the BD schedule.

```mermaid
flowchart TD
    BD_File[BD Schedule XLSX] --> BD_Parser[ExcelJS Extraction]
    BD_Parser --> ReadFields[Extract Critical Columns:<br/>- Project No<br/>- Project Shortname / Client<br/>- Stream (1, 2, 3)<br/>- Order Area (m2)<br/>- Target Delivery Date<br/>- Font Color Code]
    ReadFields --> ValidateColors[Normalize Font Color:<br/>• Black: Standard Production<br/>• Red: Urgent / Priority Stream<br/>• Blue: Plant Unit A<br/>• Green: Plant Unit B<br/>• Purple: Special Alloy / Prototype]
    ValidateColors --> SeedMR11[Seed Initial Rows in MR11 Engine]
```

### BD Key Columns:
- `Project No`: Primary alphanumeric identifier (e.g. `MFE-2024-001`, `PRJ-882`).
- `Project Shortname`: Human-readable customer or site abbreviation.
- `Stream`: Parallel fabrication stream identifier (`Stream 1`, `Stream 2`).
- `Area (m2)`: Total contract formwork surface area.
- `Target Delivery Date`: Customer agreed site delivery requirement.
- `Font Color`: Strategic plant allocation / line priority designation.

---

## 3. Finance Department - Commercial Clearance

The Finance workbook details payment status, commercial risks, and ensures manufacturing or shipping is not released without contractual clearances.

```mermaid
sequenceDiagram
    participant Officer as Finance Officer
    participant DeptService as Department Service
    participant Engine as MR11 Engine
    participant Master as Master Schedule

    Officer->>DeptService: Uploads Finance.xlsx
    DeptService->>DeptService: Parse Payment Milestones & LC Status
    DeptService->>Engine: Re-run MR11 Reconciliation
    Engine->>Engine: Match by Project No & Stream
    Engine->>Master: Update Advance % Received, LC Clearance, Payment Warnings
    alt Advance < 30% and Target Delivery Near
        Master->>Master: Set Warning Flag: "Commercial Clearance Pending"
    else Advance >= 30%
        Master->>Master: Set Flag: "Commercial Cleared"
    end
```

### Finance Key Columns:
- `Project No`: Project matching key.
- `Advance Payment %`: Percentage of contract advance credited.
- `Letter of Credit (LC) Status`: Active, Under Review, or Approved.
- `Payment Terms`: Milestone schedule (e.g., 30/60/10).

---

## 4 & 5. Shell Plan & Design - One Combined Workbook

Shell Plan and Design fill in one shared workbook (the "Shell Plan & Design" template). Either role can upload it, and it is stored under DESIGN. Its rows feed both the Shell Plan and the Design columns of MR11.

```mermaid
flowchart TD
    Upload[Upload Shell Plan & Design workbook] --> Parse[Extract rows: merged cells filled down, fill colour per block]
    Parse --> Match{Match BD row: project no., stream, fill colour}
    Match --> SP[Shell Plan status, revision, submission & approval dates]
    Match --> DES[Formwork design status, order completion date per level, m2 ordered]
    Match --> HA[Holing & accessories status and completion dates]
    SP --> MR11[MR11 master row]
    DES --> MR11
    HA --> MR11
```

### Layout
- One header row, one row per **Level** (Typical, Upper lv.10 ...). The project, building and Shell Plan columns are merged down across a building's levels.
- `Project No.` may carry the stream as an extra last digit (`251242` = project `25124`, stream 2). A `Stream` column is also read.
- A project that appears more than once is told apart by the **fill colour of its Project Name cell**, matched to the BD row's fill colour.
- Blank columns between the sections (Shell Plan | Design | Holing | Accessories) are ignored.

### Key Columns
- Shell Plan: `Project Name`, `BD`, `Project No.`, `Building Name`, `DCF`, `Shell Plan Status` (`Approved`, `In Progress`, `Reapprove`, `Pending Drawings`), `Shell Plan Start Date`, `Latest Revision`, `Latest Submission Date`, `Shell Plan Approved Date`, `Remarks (...)`.
- `NCA`, `NCA Date`: for reference on the sheet; MR11 takes NCA from BD.
- Design: `Stream`, `Level`, `Formwork Design Status` (`To Start`, `Ongoing`, `Completed`, `Pending Shell Approval`, `On Hold`), `Estimated Design Completion Date` (date or TBC), `Actual Formwork Order Completion Date`, `Total Quantity Ordered M2`, `Design Remarks`.
- Holing: `Holing Status` (`Completed` / `Not Completed`), `Holing Start Date`, `Holing Completion Date`, `Remarks`.
- Accessories: `Accessories Status`, `Accessories Start Date`, `Accessories Completion Date`, `Remarks`.

---

## 6. Planning & Production - Dynamic Series Tracking

Planning and Production feature dynamic multi-series tracking. Formwork orders are delivered in sequential manufacturing series (Series 1, Series 2, Series 3, etc.).

```mermaid
flowchart TB
    subgraph PlanningFlow ["Planning Workflow"]
        PlanUpload[Upload Planning.xlsx] --> PlanScanner[Scan Series Columns (S1, S2, S3...)]
        PlanScanner --> PlanColor[Extract Cell Font Colors & Fills]
        PlanColor --> PlanUpsert[Upsert PlanningSeriesHistory Records:<br/>- projectNo<br/>- stream<br/>- fontColor<br/>- seriesNumber<br/>- totalProcessed]
        PlanUpsert --> PlanCalc[Update PlanningProjectQuantityTracker]
    end

    subgraph ProductionFlow ["Production Workflow"]
        ProdUpload[Upload Production.xlsx] --> ProdScanner[Scan Series Columns (S1, S2, S3...)]
        ProdScanner --> ProdColor[Extract Cell Font Colors & Fills]
        ProdColor --> ProdUpsert[Upsert ProductionSeriesHistory Records:<br/>- projectShortname<br/>- stream<br/>- fontColor<br/>- seriesNumber<br/>- totalFabricated]
    end

    subgraph MR11Consolidation ["MR11 Matching Logic"]
        MatchSeries[Align Planning & Production Series on: Project + Stream + Font Color]
        CompareSeries[Calculate Planning vs Production Gap: Processed m2 vs Fabricated m2]
        InjectMR11[Inject Total Processed m2 & Total Fabricated m2 into MR11 Master Row]
    end

    PlanCalc --> MatchSeries
    ProdUpsert --> MatchSeries
    MatchSeries --> CompareSeries
    CompareSeries --> InjectMR11
```

---

## 7. Dispatch Department - Logistics & Shipping

Dispatch coordinates crating, container stuffing, bill of lading, and sailing dates.

```mermaid
sequenceDiagram
    autonumber
    participant Officer as Dispatch Team
    participant DeptService as Department Service
    participant MR11 as MR11 Master Row

    Officer->>DeptService: Uploads Dispatch.xlsx
    DeptService->>DeptService: Extract Container Nos, Sailing Date, Site Delivery Date
    DeptService->>MR11: Reconcile with MR11 Project
    MR11->>MR11: Calculate Delivery Lead Time Delta = (Actual Delivery Date - BD Target Delivery Date)
    alt Delta <= 0 Days
        MR11->>MR11: Flag "Delivered On Time" (Green)
    else Delta > 0 Days
        MR11->>MR11: Flag "Delayed Delivery" (Red / Amber Alert)
    end
```

### Dispatch Key Columns:
- `Container Numbers`: Shipping container serial identifiers.
- `Estimated Sailing Date (ETD)`: Vessel departure date.
- `Actual Delivery Date`: On-site client handover date.
- `Dispatch Status`: `Loaded`, `Sailing`, `Customs Cleared`, `Delivered`.
