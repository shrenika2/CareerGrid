# 🎓 CareerGrid — Unified Internship & Placement Platform

> **Google Solution Challenge 2026: Build with AI — Submission by Team *Last Second Squad***  
> **Institution:** Walchand College of Engineering, Sangli (B.Tech Computer Science & Engineering)  
> **Live Prototype Demo:** [my-react-app-beryl-mu.vercel.app](https://my-react-app-beryl-mu.vercel.app)  
> **🎯 Targeted UN SDGs:** 📚 Quality Education (4) | 💼 Decent Work & Economic Growth (8) | 🤝 Reduced Inequalities (10)

CareerGrid is a decoupled, multi-role recruitment and placement ecosystem. The project connects students, faculty, companies, and administrators into a single digital platform. By leveraging Google Gemini AI for contextual career assistance and FastAPI for WebSocket-based mock interviews, it aims to streamline college placement pipelines while reducing manual screening bias.

---

## 📖 Table of Contents

1. [Architectural Overview & Decoupled Design](#-architectural-overview--decoupled-design)
2. [Core Technical Specifications](#-core-technical-specifications)
3. [Engineering Safeguards & Resilience](#-engineering-safeguards--resilience)
4. [Database Design & Indexing Strategy](#-database-design--indexing-strategy)
5. [Real-time Events & Data Flow](#-real-time-events--data-flow)
6. [Project Structure](#-project-structure)
7. [Getting Started & Local Setup](#-getting-started--local-setup)
8. [Environment Variable Configuration](#-environment-variable-configuration)
9. [REST API Reference & WebSocket Protocols](#-rest-api-reference--websocket-protocols)
10. [Google Cloud Integration & Future Roadmap](#-google-cloud-integration--future-roadmap)
11. [Development Team](#-development-team)

---

## 📐 Architectural Overview & Decoupled Design

The platform uses a decoupled microservices architecture to segregate concerns, optimize scaling, and avoid blocking the event loop:

```
                  ┌──────────────────────────────────────────┐
                  │          React Frontend (Vite)           │
                  │   Port: 5173 / Firebase CDN Deployment   │
                  └────────────────────┬─────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                │                                             │
      HTTP REST / Socket.io                         WebSocket / HTTP
                │                                             │
                ▼                                             ▼
  ┌───────────────────────────┐                 ┌───────────────────────────┐
  │     Main Backend API      │                 │      AI Microservice      │
  │    Node.js / Express      │                 │     Python / FastAPI      │
  │       Port: 5000          │                 │        Port: 8000         │
  └─────────────┬─────────────┘                 └─────────────┬─────────────┘
                │                                             │
         Mongoose / TCP                                 LangChain API
                │                                             │
                ▼                                             ▼
  ┌───────────────────────────┐                 ┌───────────────────────────┐
  │    MongoDB Atlas DB       │                 │     LLM Orchestration     │
  │   (Clustered Storage)     │                 │   Gemini / OpenAI / Groq  │
  └───────────────────────────┘                 └───────────────────────────┘
```

### Technical Design Rationale:
1. **Node.js/Express API Gateway:** Serves as the primary entry point for I/O-bound tasks like user management, CRUD operations for postings, application status tracking, and database queries.
2. **FastAPI AI Microservice:** CPU-bound processing (such as parsing large PDF resumes) and long-lived WebSocket connections for text-streaming mock interviews are offloaded to an asynchronous Python FastAPI service. This architecture prevents PDF parsing workloads or persistent interview loops from blocking the Express event loop.
3. **Frontend SPA:** Built with React 18 and Vite for fast client rendering. It contains role-specific dashboards with context-aware AI coaching interfaces and real-time dashboard analytics using Recharts.

---

## 🛠️ Core Technical Specifications

### Frontend (`/client`)
- **React (v18.3) & Vite:** Optimized dev execution and build packaging.
- **Tailwind CSS & Framer Motion:** Fluid micro-animations and responsive glassmorphism styles.
- **Recharts (v3.7):** Renders candidate funnel analytics and skill supply vs demand charts.
- **Sentry Integration:** Client-side error tracking and session replay.
- **Socket.io Client:** Subscribes to real-time status updates and placement announcements.

### Main Backend (`/server`)
- **Node.js & Express:** Primary REST server.
- **MongoDB & Mongoose (v8.6):** Structured schemas, validation hooks, and custom optimization indexes.
- **Authentication:** Stateless JWT-based Role-Based Access Control (RBAC).
- **Security Middleware:** Rate limiting (`express-rate-limit`), secure HTTP headers (`helmet`), and CORS config.
- **Validation:** Input payload validation using `joi` to filter malformed data before database write.
- **Logging:** Structured logs written using `winston` and `morgan`.
- **Sentry Integration:** Active tracking of unhandled exceptions and performance profiling in production.
- **Testing:** Unit and integration testing built using `jest` and `supertest`, leveraging `mongodb-memory-server` for isolated database sessions.

### AI Microservice (`/ai-backend`)
- **FastAPI:** High-performance asynchronous routing with automatic OpenAPI schema generation.
- **WebSockets:** Stateful bidirectional communication for mock interviews.
- **Text & PDF Parsing:** Extracting text using `PyPDF2` (resumes) and `mammoth` (DOCX files).
- **LangChain:** Manages prompt templates, chat history buffer, and structures LLM API calls.
- **In-Memory Store:** Active interview contexts are mapped to temporary session UUIDs.

---

## 🛡️ Engineering Safeguards & Resilience

To ensure the prototype maintains production-like stability, several engineering safeguards are implemented:

### 1. Database Query Timeouts
Mongoose database queries are wrapped in a strict 3-second timeout utility using `Promise.race` in the [aiController.js](file:///c:/PICT_FINAL_PROJECT/PICT_PROJECT_2/PICT_PROJECT_2/server/controllers/aiController.js):
```javascript
const runWithTimeout = async (promise, timeoutMs = 3000) => {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Database operation timeout')), timeoutMs);
    });
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timer);
        return result;
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
};
```
This protects Node.js worker threads from hanging indefinitely during database network degradation.

### 2. Graceful Degradation (Degraded Mode Operations)
If a database timeout or a FastAPI microservice connection failure occurs during key operations (e.g., submitting interview results or fetching details), the system catches the exception and returns a formatted mock/demo dataset. This prevents frontend components from crashing, allowing recruiters and students to continue exploring the interface:
```javascript
catch (err) {
    console.error('[AI_CONTROLLER] Submit attempt failed or timed out:', err.message);
    
    // Return structured degraded dataset to prevent front-end crashes
    return res.status(201).json({
        success: true,
        isMock: true,
        attempt: {
            _id: new mongoose.Types.ObjectId(),
            student: studentId,
            jobTitle,
            responses,
            score: finalCalculatedScore,
            breakdown: { technical, communication },
            completedAt: new Date()
        }
    });
}
```

### 3. Role-Based Security & Admin Escalation Protection
To prevent unauthorized users from escalating their privileges to `admin`, the [User.js](file:///c:/PICT_FINAL_PROJECT/PICT_PROJECT_2/PICT_PROJECT_2/server/models/User.js) schema implements a virtual field validation check inside a pre-validate hook. A system-level secret key (`ADMIN_CREATION_SECRET`) must be provided to create or upgrade a user to the `admin` role:
```javascript
userSchema.virtual('adminSecret')
    .get(function() { return this._adminSecret; })
    .set(function(value) { this._adminSecret = value; });

userSchema.pre('validate', function(next) {
    if (this.isModified('role') && this.role === 'admin') {
        const secret = process.env.ADMIN_CREATION_SECRET || 'fallback_secret_token';
        if (this.adminSecret !== secret && this._adminSecret !== secret) {
            this.invalidate('role', 'Admin registration is restricted.');
        }
    }
    next();
});
```

### 4. High-Performance Dashboard Analytics Caching
Platform analytics are compiled via complex MongoDB Aggregation pipelines. To avoid query spikes, the [analyticsService.js](file:///c:/PICT_FINAL_PROJECT/PICT_PROJECT_2/PICT_PROJECT_2/server/services/analyticsService.js) implements an in-memory cache with a 5-minute eviction policy:
```javascript
let cache = { data: null, timestamp: 0 };
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Dashboard requests serve data from cache unless expired or forced
if (!forceRefresh && cache.data && (Date.now() - cache.timestamp < CACHE_DURATION)) {
    return cache.data;
}
```

---

## 📊 Database Design & Indexing Strategy

To optimize database query performance as the application grows, indexes have been strategically applied to match key query patterns:

| Model / Target Collection | Fields Indexed | Index Type | Query Optimization Pattern |
|---|---|---|---|
| **User** ([User.js](file:///c:/PICT_FINAL_PROJECT/PICT_PROJECT_2/PICT_PROJECT_2/server/models/User.js)) | `{ role: 1, status: 1 }` | Compound | Speeds up admin directories and verification lists |
| **User** ([User.js](file:///c:/PICT_FINAL_PROJECT/PICT_PROJECT_2/PICT_PROJECT_2/server/models/User.js)) | `{ "studentProfile.branch": 1 }` | Single-Field | Filters candidates by academic department |
| **User** ([User.js](file:///c:/PICT_FINAL_PROJECT/PICT_PROJECT_2/PICT_PROJECT_2/server/models/User.js)) | `{ "studentProfile.year": 1 }` | Single-Field | Filters candidates by graduation year |
| **Application** ([Application.js](file:///c:/PICT_FINAL_PROJECT/PICT_PROJECT_2/PICT_PROJECT_2/server/models/Application.js)) | `{ opportunity: 1, student: 1 }` | Compound & Unique | Prevents duplicate applications per student per opportunity |
| **Application** ([Application.js](file:///c:/PICT_FINAL_PROJECT/PICT_PROJECT_2/PICT_PROJECT_2/server/models/Application.js)) | `{ opportunity: 1, status: 1 }` | Compound | Speeds up drive pipelines (e.g. "Get Shortlisted for Job X") |
| **Application** ([Application.js](file:///c:/PICT_FINAL_PROJECT/PICT_PROJECT_2/PICT_PROJECT_2/server/models/Application.js)) | `{ opportunity: 1, skillMatchScore: -1 }` | Compound | Ranks top matching candidates for employer screening |
| **Application** ([Application.js](file:///c:/PICT_FINAL_PROJECT/PICT_PROJECT_2/PICT_PROJECT_2/server/models/Application.js)) | `{ student: 1, createdAt: -1 }` | Compound | Speeds up the student's personal application history list |
| **PracticeAttempt** ([PracticeAttempt.js](file:///c:/PICT_FINAL_PROJECT/PICT_PROJECT_2/PICT_PROJECT_2/server/models/PracticeAttempt.js)) | `{ student: 1, createdAt: -1 }` | Compound | Loads student progress charts and dashboards |
| **PracticeAttempt** ([PracticeAttempt.js](file:///c:/PICT_FINAL_PROJECT/PICT_PROJECT_2/PICT_PROJECT_2/server/models/PracticeAttempt.js)) | `{ student: 1, isCorrect: 1 }` | Compound | Tallies correct/incorrect answers for metrics |

---

## 📡 Real-time Events & Data Flow

```
1. Setup Session   : Client ──[POST Resume & Job Description]──► Node Server ──[Forward Resume Text]──► FastAPI
2. Handshake       : Client ◄────────────────[Returns unique session_id]───────────────────────────────┘
3. Connection      : Client ◄──────────────────[Establishes WebSocket]─────────────────────────► FastAPI
4. Streaming Loop  : Client ◄─────────[Prompt & Answer Stream / Word-by-Word Tokens]───────────► FastAPI (LangChain/LLM)
5. Completion      : Client ◄───────────────────────[Sends "[DONE]"]────────────────────────────┘
6. Submission      : Client ──[POST Attempt Transcript & Answers]──► Node Server ──[Socket.io Broadcast]──► Admin Console
```

1. **WebSocket Mock Interview Stream:** The frontend sends resume text and target Job Description details to `/api/setup-interview-text` to receive a `session_id`. The client then opens a standard WebSocket connection directly to the FastAPI server at `/ws/interview/{session_id}`.
2. **Streaming Tokens:** FastAPI constructs a role-aware prompt context, coordinates with the model using LangChain, and streams response tokens back over the WebSocket. The client aggregates these tokens to read questions using speech synthesis.
3. **Socket.io Event Broadcasts:** Express handles system notifications (like application status changes, student team invites, or system-wide announcements). When a student completes an interview attempt, a Socket.io event `metrics_update` is emitted to the target student room (`user_{studentId}`) to trigger an dynamic progress-ring animation in the client UI.

---

## 📁 Project Structure

```
CareerGrid/
├── client/                          # React Frontend (Vite Single Page App)
│   ├── src/
│   │   ├── components/              # Shared dashboard components
│   │   ├── features/                # Custom hooks (e.g. useChatbot.js)
│   │   ├── pages/                   # Role-specific dashboard layouts
│   │   ├── context/                 # Context providers (Auth, Notifications)
│   │   ├── App.jsx                  # Main client-side router
│   │   └── main.jsx                 # Sentry configuration and SPA mount
│   ├── package.json
│   └── vite.config.js
│
├── server/                          # Main Backend API (Node.js & Express)
│   ├── config/                      # Environment and DB config files
│   ├── controllers/                 # MERN API controllers (RBAC guarded)
│   ├── middleware/                  # Auth, error handling, rate limiters
│   ├── models/                      # MongoDB Schemas & Index definitions
│   ├── services/                    # Analytics & Notification implementations
│   ├── tests/                       # Jest integration test suites
│   ├── server.js                    # Express startup entry point
│   └── package.json
│
├── ai-backend/                      # Python AI Microservice (FastAPI sidecar)
│   ├── main.py                      # WebSocket & REST endpoints
│   ├── requirements.txt             # LangChain & PDF parsing dependencies
│   └── Dockerfile                   # Container config
│
├── start_servers.bat                # Windows utility to launch all dev environments
├── docker-compose.yml               # Multi-container orchestration config
├── PRODUCTION_STRATEGY.md           # High availability scaling guidelines
└── README.md                        # Project documentation (This file)
```

---

## ⚙️ Getting Started & Local Setup

### Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)
- **MongoDB** (Local instance or Mongo Atlas Cluster URI)
- **API Keys:** A Google Gemini API Key and/or an OpenAI API Key.

### Method A: Start Everything at Once (Windows)
A batch script is provided to automate environment setup, activate venvs, install dependencies, and run all microservices in parallel windows:
```batch
start_servers.bat
```

### Method B: Start Services Manually

1. **Main Node.js Backend API**
   ```bash
   cd server
   npm install
   npm run dev          # Starts on http://localhost:5000
   ```

2. **React Frontend (Vite)**
   ```bash
   cd client
   npm install
   npm run dev          # Starts on http://localhost:5173
   ```

3. **Python AI Microservice**
   ```bash
   cd ai-backend
   python -m venv venv
   # Activate virtual environment
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate

   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000  # Starts on http://localhost:8000
   ```

4. **Running Automated Backend Tests**
   ```bash
   cd server
   npm run test
   ```

---

## 🔑 Environment Variable Configuration

Create corresponding `.env` files in each service directory using the templates below:

### `server/.env`
```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/internmatch
JWT_SECRET=your_jwt_signing_key_here
ADMIN_CREATION_SECRET=super_secret_admin_creation_token_98765
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
OPENAI_API_KEY=your_openai_api_key_here
```

### `ai-backend/.env`
```env
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_API_KEY=your_gemini_api_key_here
OLLAMA_HOST=http://127.0.0.1:11434
```

### `client/.env`
```env
VITE_API_URL=http://localhost:5000/api
VITE_AI_API_URL=http://localhost:8000
VITE_SENTRY_DSN=your_sentry_dsn_here
```

---

## 📡 REST API Reference & WebSocket Protocols

### REST Endpoint Mapping

| Method | Endpoint | Auth Level | Payload Schema | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | None | `{ name, email, password, role, studentProfile: {...} }` | Registers user profiles |
| `POST` | `/api/auth/login` | None | `{ email, password }` | Authenticates user & returns JWT |
| `GET` | `/api/opportunities` | JWT (All roles) | None | Lists postings matching user queries |
| `POST` | `/api/opportunities` | JWT (Company/Faculty) | `{ title, description, requiredSkills, eligibility }` | Publishes internship posting |
| `POST` | `/api/applications` | JWT (Student) | `{ opportunity, resumeUrl, coverLetter }` | Submits candidate application |
| `PATCH` | `/api/applications/:id` | JWT (Company) | `{ status: "shortlisted" \| "accepted" \| "rejected" }` | Updates application selection stage |
| `GET` | `/api/admin/analytics` | JWT (Admin) | None | Aggregated charts (Cached for 5 mins) |
| `POST` | `/api/ai/setup-local-session` | JWT (Student) | `{ opportunityId }` | Triggers resume text extraction |
| `POST` | `/api/ai/interview-attempts` | JWT (Student) | `{ jobTitle, responses: [...] }` | Saves mock interview stats & scores |

### Python Microservice REST Mapping

| Method | Endpoint | Payload Schema | Description |
|---|---|---|---|
| `POST` | `/api/setup-interview` | `multipart/form-data` (PDF + JD) | Parses PDF stream and stores session context |
| `POST` | `/api/setup-interview-text` | `{ resume_text, job_description }` | Pre-sets interview context via extracted text |
| `POST` | `/api/evaluate-interview` | `{ session_id }` | Scores transcript context and returns JSON critique |

### WebSocket Endpoint Protocols
- **Connection URL:** `ws://localhost:8000/ws/interview/{session_id}`
- **Message Protocol:**
  - Client sends raw text answer string: `"My experience with React involves hooks..."`
  - Server streams text tokens back chunk-by-chunk (e.g. `"What"`, `" are"`, `" hooks"`).
  - Server sends string delimiter `[DONE]` to flag prompt-response termination.

---

## ☁️ Google Cloud Integration & Future Roadmap

To move the platform from local prototype to production, the following cloud integration phases are mapped:

### Phase 1: Authentication & Hosting Migration (Target: Next Sprint)
- [ ] **Google OAuth Integration:** Replace simulated authentication with Firebase Authentication.
- [ ] **Frontend Deployment:** Automate client builds to Firebase Hosting CDN for global caching.
- [ ] **Key Security:** Transition Gemini client API calls into server-side proxies, restricting API key leakage in JS bundles.

### Phase 2: Serverless Containerization & Storage (Target: Production Release)
- [ ] **Google Cloud Run:** Package both Node.js API and Python FastAPI service in separate Docker containers for serverless autoscaling.
- [ ] **Google Cloud Storage (GCS):** Replace third-party storage APIs with GCS buckets for candidate resume storage.
- [ ] **Redis Cluster Deployment:** Deploy Memorystore (Redis) to act as a `@socket.io/redis-adapter` sync and WebSocket state store to support multi-node scaling.

### Phase 3: Vertex AI & Advanced ML Models (Target: Q3 Roadmap)
- [ ] **Custom Scoring Model:** Deploy a Vertex AI Auto pipeline to grade internship fit based on student performance history and corporate hiring funnels.
- [ ] **Gemini Vision API:** Integrate Vision models to parse image-based PDF resumes.
- [ ] **GA4 Funnels:** Incorporate Google Analytics 4 tracking to monitor platform drop-off rates and student training completion funnels.

---

## 👩‍💻 Development Team — *Last Second Squad*

| Name | Academic Role / Focus | Contact Email |
| :--- | :--- | :--- |
| **Shrenika Sajjankumar Patil** | Team Lead & Full-Stack Developer | [shrenikapatil0211@gmail.com](mailto:shrenikapatil0211@gmail.com) |
| **Gargi Salunkhe** | Frontend Engineer & UX Designer | [gargisalunkhe1076@gmail.com](mailto:gargisalunkhe1076@gmail.com) |
| **Maruti Sarjerao Gaikwad** | Backend Systems & Database Architecture | [marutigaikwad2408@gmail.com](mailto:marutigaikwad2408@gmail.com) |
| **Tanuj Ravindra Bhoite** | AI Microservice Integration & WebSockets | [tanujbhoite@gmail.com](mailto:tanujbhoite@gmail.com) |

*Walchand College of Engineering, Sangli — Department of Computer Science & Engineering*
