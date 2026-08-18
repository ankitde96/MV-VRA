# **VRA Platform Feature Specification (MVP)**

## **1. Architectural Imperatives and Tech Stack**

The Vendor Risk Assessment (VRA) platform serves as a centralized system of record for managing third-party risk. For this phase, the architecture will focus on a streamlined workflow orchestration engine without complex external integrations or AI agentic layers.

### **1.1. Technology Stack**

- **Framework:** Next.js (Frontend and API routes)
- **Database:** MongoDB (Document-oriented NoSQL)
- **File/Evidence Storage:**
  - **Production:** AWS S3
  - **Local Development:** Local file system folders

### **1.2. Authentication & Authorization**

- **Internal Users (Admin/Risk Team):**
  - _Development:_ Static super admin user ID and password.
  - _Production/Future:_ Google SSO integration (Parked for later implementation).
- **Vendor Users:**
  - Email One-Time Password (OTP) authentication.
  - The designated Vendor Single Point of Contact (SPOC) receives the OTP to log into the portal.

### **1.3. Workflow and Governance Orchestration Core**

The core engine manages operational governance processes. It drives dynamic intake forms, contextual vendor tiering, external portal collaboration, unified risk register synchronization, and multi-tenant workspace isolation.

---

## **2. Required Core Functional Features Specification**

### **2.1. Vendor Intake, Inventory, and Dynamic Tiering**

The primary interface begins at vendor intake. The platform provides structured self-service intake forms for business owners.

- **Vendor SPOC Management:** Ability to add and manage a Vendor SPOC (Name, Email, and Phone Number) within the vendor details page. This SPOC will be the primary external user receiving the Email OTP for portal access.
- **Self-Service Vendor Intake:** Configurable intake web forms allowing internal stakeholders to submit vendor request proposals, defining expected procurement dates, business unit ownership, and functional scope.
- **Inherent Risk Engine:** Algorithmic scoring matrix evaluating data types processed (PII, PHI, Financial), network exposure, system access level, and business redundancy to assign initial vendor risk tiers.
- **Tiering & Triage Workflows:** Rules-based routing logic assigning intake records into Tier 1 (High Criticality), Tier 2 (Medium Criticality), or Tier 3 (Low Criticality) risk buckets.

### **2.2. Intelligent Assessment and Questionnaire Engine**

The platform features a dynamic assessment engine with modular template building capabilities.

- **Collaborative Vendor Portal:** A secure vendor portal where the Vendor SPOC authenticates via Email OTP. Once logged in, they can answer questionnaires and directly upload compliance evidence (saved to local folder or S3).
- **Dynamic Conditional Logic:** Questionnaire branching displaying or suppressing follow-up questions based on specific responses (e.g., hiding cloud security controls if hosting is on-premise).
- **Response Validation & Pre-Screening:** Validation checks that flag empty responses or missing attachments before final submission, minimizing back-and-forth communication.
- **Version-Controlled Templates:** Template builder supporting versioning, draft states, control lockouts, and backward-compatible data schemas for active historical assessments.

### **2.3. Unified Risk Register and Mitigation Workflow**

The platform maintains a centralized risk register that links identified third-party vulnerabilities and questionnaire exceptions.

- **Unified Risk Register Mapping:** Mapping of third-party risks to organizational risk registers, linking control gaps to enterprise risk categories and impact levels.
- **Residual Risk Calculation:** Algorithmic residual risk scoring incorporating verified vendor controls and compensating security measures against initial inherent risk metrics.
- **Remediation Task Tracking:** Internal tracking and escalation of corrective action plans (CAPs) for internal owners or external vendor personnel.
- **Out-of-the-Box Mitigation Guidance:** Pre-configured mitigation suggestions mapping specific control failures to actionable remediation steps.

### **2.4. Vendor Offboarding and Data Destruction Verification**

The platform enforces formal offboarding workflows when contracts expire or terminate to prevent data retention risks.

- **Offboarding Lifecycle Workflow:** Multi-stage offboarding checklist orchestrating tasks across internal teams when a vendor engagement ends.
- **Certificate of Data Destruction Tracking:** Intake, storage, and verification of signed Certificates of Data Destruction and asset return attestations.
- **Historical Assessment Archiving:** Immutable record archival preserving historical assessments, remediation logs, and audit trails to meet retention mandates.

### **2.5. Multi-Entity Workspace Segmentation and Federated Governance**

The platform supports distinct workspace isolation for regional subsidiaries while retaining centralized corporate oversight.

- **Multi-Tenant Workspace Isolation:** Dedicated workspaces for distinct business entities or regional operations with role-based access control (RBAC).
- **Cross-Workspace Document Sharing:** Central repository enabling distinct subsidiaries to reuse verified vendor documentation and risk ratings.
- **Consolidated Executive Roll-ups:** Global dashboard aggregating risk postures across all subsidiary workspaces into a unified view.

---

## **3. Data Model Entity Schema Overview (MongoDB)**

Given the MongoDB tech stack, the data schema utilizes nested documents and collections:

- **Vendor Profile:** `vendor_id`, `legal_name`, `domain`, `inherent_risk_tier`, `lifecycle_status`.
  - **Vendor SPOC (Subdocument):** `spoc_name`, `spoc_email`, `spoc_phone`.
- **Engagement:** `engagement_id`, `vendor_id`, `business_owner_id`, `data_classification`, `status`.
- **Risk Assessment:** `assessment_id`, `engagement_id`, `template_id`, `status`, `overall_score`.
- **Questionnaire Template:** `template_id`, `version`, `questions_schema` (JSON definition of dynamic logic).
- **Question / Control Response:** `control_id`, `question_text`, `response_value`, `evidence_file_url` (S3/Local path).
- **Identified Risk:** `risk_id`, `control_id`, `severity`, `residual_score`, `remediation_owner`, `status`.
- **Workspace / Tenant:** `workspace_id`, `entity_name`, `settings`.

---

## **4. Future Development Roadmap (Parked Features)**

The following features have been explicitly scoped out of the initial MVP release but are documented for future platform evolution:

1.  **AI-Powered Evidence Analysis and Automated Questionnaire Generation:** RAG engines and OCR for automated parsing of evidence artifacts and citation-backed questionnaire auto-filling.
2.  **Internal User Google SSO:** Integration with Google Workspace for seamless internal authentication.
3.  **Automated Inventory Discovery & Ingestion Layer:** Background workers polling Identity Providers (e.g., Okta, Azure AD) or CMDBs to passively identify new application authorizations.
4.  **Agentic AI and Aggregation Engine:** AI copilot capabilities for conversational GRC queries and automated risk triaging.
5.  **Control Framework Library:** Pre-mapped database of standard frameworks (SOC 2, ISO 27001, NIST CSF) with cross-walk capabilities.
6.  **Continuous Monitoring and Threat Intelligence:** Ingestion of outside-in cybersecurity ratings, dark web leak detection, and sanctions lists.
7.  **Contract Lifecycle and SLA Performance Tracking:** Monitoring of uptime, response times, contractual cure periods, and automated financial penalty tracking.
8.  **Third-Party Integration Ecosystem:** Bidirectional synchronization with external ticketing and ERP systems (e.g., Jira, Azure DevOps, Workday).
