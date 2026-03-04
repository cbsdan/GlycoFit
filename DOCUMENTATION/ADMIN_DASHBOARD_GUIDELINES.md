# GlycoFit Admin Dashboard — Comprehensive Guidelines

> **App Context:** GlycoFit is a lifestyle tracker with prediabetes risk assessment and management. Patients track food, steps, sleep, smoking, and alcohol — all feeding into a weighted overall diabetes risk score. Physicians connect to patients, conduct telehealth consultations via Google Meet, write SOAP notes, and prescribe medications. The admin panel oversees the entire ecosystem.

---

## Sidebar Navigation Structure

| # | Tab | Icon Suggestion | Priority |
|---|-----|-----------------|----------|
| 1 | **Dashboard** | `DashboardOutlined` | Core |
| 2 | **User Management** | `PeopleOutlined` | Core |
| 3 | **Physician Management** | `LocalHospitalOutlined` | Core |
| 4 | **Risk & Assessments** | `AssessmentOutlined` | Core |
| 5 | **Health Trackers** | `MonitorHeartOutlined` | Core |
| 6 | **Nutrition & Meals** | `RestaurantOutlined` | Core |
| 7 | **Consultations & Telehealth** | `VideoCallOutlined` | Core |
| 8 | **Chat & Communication** | `ChatOutlined` | Secondary |
| 9 | **AI & Chatbot** | `SmartToyOutlined` | Secondary |
| 10 | **System & Services** | `SettingsOutlined` | Core |

---

## Tab 1 — Dashboard (Home Overview)

**Purpose:** At-a-glance operational snapshot of the entire platform.

### Content

#### Row 1 — Key Metric Cards (4–6 cards)
| Card | Data Source | Value | Subtitle/Trend |
|------|------------|-------|-----------------|
| **Total Users** | `users` collection count | Number | +X this week |
| **Active Users** | `users` where `isDisabled != true` | Number | % of total |
| **Physicians** | `users` where `role == 'physician'` | Number | X currently available |
| **Disabled Users** | `users` where `isDisabled == true` | Number | X permanent / X temporary |
| **Overall High-Risk Patients** | `overall_risk_assessments` where `overall_risk_category` is `high` or `very_high` | Number | % of assessed users |
| **Active Consultations** | `consultations` where `status` in (`pending`, `approved`, `in_progress`) | Number | X pending approval |

#### Row 2 — Charts (2 columns)
| Chart | Type | Data |
|-------|------|------|
| **New Registrations Trend** | Line chart | Registrations per day (last 30/90/365 days, selectable) |
| **Risk Distribution** | Doughnut/Pie chart | Count of users per overall risk category: low / moderate / high / very_high |

#### Row 3 — Charts (2 columns)
| Chart | Type | Data |
|-------|------|------|
| **Top 10 Logged Foods** | Horizontal bar chart | Most frequently logged meals (existing endpoint) |
| **Tracker Adoption** | Stacked bar / Grouped bar | How many users have baselines for each tracker (food, sleep, steps, smoking, alcohol) |

#### Row 4 — Activity Feed / Recent Items
| Section | Content |
|---------|---------|
| **Recent Registrations** | Last 5 new users with name, role, date registered |
| **Recent Consultations** | Last 5 consultation requests with patient name, physician name, status |
| **High-Risk Alerts** | Users whose risk category recently changed to `high` or `very_high` |

### Backend Endpoints Needed
| Status | Endpoint | Notes |
|--------|----------|-------|
| ✅ Exists | `GET /admin/users/stats` | Total, active, physicians, disabled counts |
| ✅ Exists | `GET /admin/users/analytics` | Registration trends |
| ✅ Exists | `GET /admin/meals/top-foods` | Top foods chart |
| 🆕 New | `GET /admin/risk/distribution` | Count of users per risk category |
| 🆕 New | `GET /admin/tracker/adoption` | Count of baselines per tracker type |
| 🆕 New | `GET /admin/consultations/summary` | Consultation stats (pending/active/completed counts) |
| 🆕 New | `GET /admin/recent-activity` | Recent registrations, consultations, risk changes |

---

## Tab 2 — User Management

**Purpose:** Full lifecycle management of all patient/user accounts.

### Content

#### Top Bar
- **Search:** Filter by name, email, Firebase UID, or MongoDB ID
- **Filters:** Role dropdown (All / User / Admin), Status (All / Active / Disabled / Temporarily Disabled), Diagnosis status (All / Pre-diabetic / Diabetic / Normal / Unset)
- **Actions:** "Create User" button, "Export CSV" button

#### Main Table
| Column | Description |
|--------|-------------|
| **Avatar** | Profile picture from Cloudinary |
| **Name** | `firstName` + `lastName` |
| **Email** | User email |
| **Role** | `user` / `admin` badge |
| **Diagnosis Status** | `diagnosis_status` field value |
| **Health Metrics** | BMI (calculated from height/weight), age, sex |
| **Risk Level** | Latest `overall_risk_category` (color-coded: green/yellow/orange/red) |
| **Trackers Active** | Icons showing which trackers have baselines (🍽️ 🚶 😴 🚬 🍺) |
| **Status** | Active / Disabled (+ temporary end date) |
| **Registered** | `createdAt` formatted |
| **Actions** | View Details, Disable/Enable, Delete |

#### User Detail Drawer/Modal (on "View Details")
Tabs inside the detail view:

**Tab A — Profile & Health Info**
- Personal: name, email, UID, avatar, role, created date
- Health metrics: age, sex, height, weight, BMI (auto-calculated)
- Diagnosis status, push notification status, FCM tokens count
- Disable history (timeline of disable/enable events with reasons)

**Tab B — Risk Overview**
- Overall risk score (gauge chart 0–100)
- Risk category badge (low/moderate/high/very_high)
- Confidence level
- Component scores breakdown (radar chart): initial assessment, food, sleep, steps, smoking, alcohol, BMI, age, sex
- Primary risk factors list
- Protective factors list
- Key improvements suggested
- Trend prediction (improving/stable/declining + 30/90 day forecasts)
- Risk assessment history (line chart over time)

**Tab C — All Trackers**
- Sub-sections for each tracker with latest metrics:
  - **Food:** Baseline risk score, daily log risk, comprehensive risk, avg calories/carbs/sugars/fiber, meal frequency
  - **Steps:** Avg daily steps (7d/30d), days met goal, activity level, step source
  - **Sleep:** Avg sleep hours (7d/30d), variability, bedtime consistency, dominant source
  - **Smoking:** Status (never/former/current), avg cigarettes/day, pack-years, years since quit
  - **Alcohol:** Avg drinks/week (7d/30d), binge episodes, drink type preferences

**Tab D — Meals & Nutrition**
- Meal history table (existing implementation)
- Nutrition summary pie chart
- Daily averages

**Tab E — Diabetes Assessment**
- Assessment answers (21 questions with values)
- Prediction result: risk level, probability percentage, confidence
- Assessment date

**Tab F — Activity & Health Connect Data**
- Synced health data (heart rate, exercise, active calories, sleep, steps from Health Connect)
- Activity log (daily steps, distance, calories burned, active minutes)

### Backend Endpoints Needed
| Status | Endpoint | Notes |
|--------|----------|-------|
| ✅ Exists | `GET /admin/users` | Paginated user list |
| ✅ Exists | `POST /admin/users/create` | Create user/physician/admin |
| ✅ Exists | `POST /admin/users/<uid>/disable` | Disable with reason/duration |
| ✅ Exists | `POST /admin/users/<uid>/enable` | Enable with reason |
| ✅ Exists | `GET /admin/users/<uid>/meals` | User's meals |
| ✅ Exists | `GET /admin/users/<uid>/sleep` | User's sleep data |
| 🆕 New | `GET /admin/users/<uid>/risk-overview` | User's overall risk + component scores + trend |
| 🆕 New | `GET /admin/users/<uid>/trackers` | All tracker metrics for a user |
| 🆕 New | `GET /admin/users/<uid>/assessment` | Diabetes assessment answers + prediction |
| 🆕 New | `GET /admin/users/<uid>/activity` | Health Connect + activity data |
| 🆕 New | `DELETE /admin/users/<uid>` | Full user deletion (cascade) |

---

## Tab 3 — Physician Management

**Purpose:** Oversee all physician accounts, their credentials, patients, and performance.

### Content

#### Top Bar
- **Search:** Filter by name, email, specialization, license number
- **Filters:** Status (All / Available / Unavailable / Disabled), Specialization dropdown
- **Actions:** "Create Physician" button (existing), "Export CSV"

#### Main Table
| Column | Description |
|--------|-------------|
| **Avatar** | Profile picture |
| **Name** | Full name |
| **Email** | Email address |
| **Specialization** | From `physicians` collection |
| **License #** | License number |
| **Patients** | `total_patients` count |
| **Consultations** | `total_consultations` count |
| **Rating** | Average rating (1–5 stars) |
| **Availability** | Available / Unavailable toggle status |
| **Account Status** | Active / Disabled |
| **Actions** | View Details, Disable/Enable |

#### Physician Detail Drawer/Modal
**Tab A — Profile & Credentials**
- Personal info: name, email, avatar
- Professional: specialization, license number, clinic name, consultation fee (₱), experience years, languages, bio
- Profile completeness indicator
- Account created date

**Tab B — Patient Connections**
- Patient list with connection status (pending / accepted / declined / disconnected)
- Each patient row shows: name, diagnosis status, risk level, connection date
- Timeline of patient requests (accepted/declined history)

**Tab C — Consultation History**
- Table: patient name, date, status (pending → approved → in_progress → completed), mode (quick_vitals / full_soap), rating
- Filters by status and date range
- Expandable row showing: meeting link, diagnosis, treatment plan, prescriptions issued

**Tab D — SOAP Notes & Prescriptions**
- SOAP notes list: patient, date, type (quick_vitals/full_soap), vitals recorded (OGTT, FBS, HbA1c)
- Prescriptions list: patient, medication, dosage, frequency, duration, status (active/completed/cancelled/refill_requested), refills used/allowed

**Tab E — Availability Schedule**
- Weekly calendar/grid view of physician's availability slots
- Per-day: start time, end time, slot duration, active status

**Tab F — Performance Metrics**
- Total consultations completed
- Average consultation rating
- Patient retention (active connections vs disconnected)
- Response time to consultation requests (pending → approved duration)
- Prescriptions issued count

### Backend Endpoints Needed
| Status | Endpoint | Notes |
|--------|----------|-------|
| ✅ Exists | `GET /admin/users` (filter role=physician) | Basic physician list |
| ✅ Exists | `POST /admin/users/create` | Create physician |
| 🆕 New | `GET /admin/physicians` | Dedicated physician list with joined `physicians` collection data |
| 🆕 New | `GET /admin/physicians/<id>/details` | Full physician profile + stats |
| 🆕 New | `GET /admin/physicians/<id>/patients` | Physician's patient connections + statuses |
| 🆕 New | `GET /admin/physicians/<id>/consultations` | Consultation history |
| 🆕 New | `GET /admin/physicians/<id>/prescriptions` | Prescriptions issued |
| 🆕 New | `GET /admin/physicians/<id>/availability` | Availability schedule |
| 🆕 New | `GET /admin/physicians/<id>/performance` | Aggregated performance metrics |

---

## Tab 4 — Risk & Assessments

**Purpose:** Population-level view of diabetes risk data and assessment results.

### Content

#### Section 1 — Overall Risk Distribution
| Component | Type | Description |
|-----------|------|-------------|
| **Risk Category Breakdown** | Doughnut chart | Users per category: low / moderate / high / very_high |
| **Unassessed Users** | Stat card | Users without any overall risk assessment |
| **Average Risk Score** | Gauge | Platform-wide average risk score (0–100) |
| **Risk Trend** | Line chart | Average risk score over time (weekly data points) |

#### Section 2 — Component Risk Heatmap
| Component | Type | Description |
|-----------|------|-------------|
| **Component Averages** | Horizontal bar chart | Average score per component (initial assessment, food, sleep, steps, smoking, alcohol, BMI) across all users |
| **Highest Risk Component** | Stat card | Which component contributes most to user risk scores |
| **Improvement Trends** | Sparklines | Per-component score trend (last 30 days) |

#### Section 3 — Diabetes Assessment Results
| Component | Type | Description |
|-----------|------|-------------|
| **Assessment Completion** | Stat card | X users completed / X total users (% assessed) |
| **Risk Level Distribution** | Pie chart | Low / Moderate / High from ML prediction |
| **Average Probability** | Stat card | Mean diabetes probability across assessed users |
| **Assessment Table** | Data table | User, risk level, probability %, confidence, date taken — sortable, filterable |

#### Section 4 — High-Risk Patient Watchlist
| Column | Description |
|--------|-------------|
| **Patient Name** | Full name |
| **Overall Risk Score** | 0–100 with color bar |
| **Risk Category** | Badge |
| **Confidence** | Preliminary / Low / Moderate / High |
| **Primary Risk Factors** | Top 3 risk factors |
| **Trend** | Improving ↗️ / Stable → / Declining ↘️ |
| **Connected Physician** | Assigned physician name or "Unconnected" |
| **Last Assessment** | Date of last overall risk computation |
| **Actions** | View full risk profile, notify physician |

### Backend Endpoints Needed
| Status | Endpoint | Notes |
|--------|----------|-------|
| 🆕 New | `GET /admin/risk/distribution` | Risk category counts |
| 🆕 New | `GET /admin/risk/component-averages` | Per-component average scores |
| 🆕 New | `GET /admin/risk/trend` | Average risk score over time |
| 🆕 New | `GET /admin/risk/high-risk-patients` | Paginated high/very_high risk users |
| 🆕 New | `GET /admin/assessments/stats` | Diabetes assessment completion stats |
| 🆕 New | `GET /admin/assessments/list` | All diabetes assessments with user info |

---

## Tab 5 — Health Trackers

**Purpose:** Aggregated view of all lifestyle tracker data across the platform.

### Content

#### Sub-Tab 5A — Food Tracking
| Component | Type | Description |
|-----------|------|-------------|
| **Baseline Completion** | Stat card | Users with food baseline / total users |
| **Avg Daily Calories** | Stat card | Platform average from meal logs |
| **Avg Daily Carbs / Sugar / Fiber** | Mini stat cards | Key diabetes-related nutrients |
| **High-Risk Nutrients** | Bar chart | % of users exceeding thresholds for added sugars, saturated fat, sodium, glycemic load |
| **Meal Logging Frequency** | Line chart | Average meals logged per day over time |
| **Meal Patterns** | Stats | % users with irregular meal times, late-night eating, meal skipping |
| **Food Risk Distribution** | Pie chart | Users by food risk level |

#### Sub-Tab 5B — Step Tracking
| Component | Type | Description |
|-----------|------|-------------|
| **Baseline Completion** | Stat card | Users with step baseline |
| **Avg Daily Steps** | Stat card | Platform average |
| **Goal Achievement** | Stat card | % of user-days meeting 10,000 step goal |
| **Activity Level Distribution** | Doughnut chart | Sedentary / Light / Moderate / Active / Highly Active |
| **Step Trends** | Line chart | Average daily steps over time |
| **Data Sources** | Pie chart | Health Connect vs Phone Sensor vs Mixed |

#### Sub-Tab 5C — Sleep Tracking
| Component | Type | Description |
|-----------|------|-------------|
| **Baseline Completion** | Stat card | Users with sleep baseline |
| **Avg Sleep Duration** | Stat card | Platform average hours |
| **Short Sleepers** | Stat card | % of users averaging <6 hours |
| **Long Sleepers** | Stat card | % of users averaging >9 hours |
| **Sleep Risk Distribution** | Doughnut chart | Users by sleep risk category |
| **Sleep Duration Distribution** | Histogram | Distribution of average sleep hours |
| **Data Sources** | Pie chart | Manual vs Health Connect |

#### Sub-Tab 5D — Smoking Tracking
| Component | Type | Description |
|-----------|------|-------------|
| **Baseline Completion** | Stat card | Users with smoking baseline |
| **Status Distribution** | Doughnut chart | Never / Former / Current smokers |
| **Current Smokers** | Stat card | Count + avg cigarettes/day |
| **Former Smokers** | Stat card | Count + avg years since quit |
| **Pack-Years Distribution** | Bar chart or box plot | Distribution of cumulative pack-years |
| **Smoking Risk Distribution** | Doughnut chart | Users by smoking risk category |

#### Sub-Tab 5E — Alcohol Tracking
| Component | Type | Description |
|-----------|------|-------------|
| **Baseline Completion** | Stat card | Users with alcohol baseline |
| **Avg Drinks/Week** | Stat card | Platform average |
| **Binge Episodes** | Stat card | Total binge episodes in last 30 days |
| **Drink Type Preferences** | Pie chart | Beer / Wine / Spirits / Mixed |
| **Alcohol Risk Distribution** | Doughnut chart | Users by alcohol risk category |
| **Gender-Based Analysis** | Bar chart | Male vs Female avg drinks + binge frequency |

### Backend Endpoints Needed
| Status | Endpoint | Notes |
|--------|----------|-------|
| 🆕 New | `GET /admin/trackers/food/stats` | Aggregated food tracking stats |
| 🆕 New | `GET /admin/trackers/steps/stats` | Aggregated step tracking stats |
| 🆕 New | `GET /admin/trackers/sleep/stats` | Aggregated sleep tracking stats |
| 🆕 New | `GET /admin/trackers/smoking/stats` | Aggregated smoking tracking stats |
| 🆕 New | `GET /admin/trackers/alcohol/stats` | Aggregated alcohol tracking stats |
| 🆕 New | `GET /admin/trackers/adoption` | Baseline completion counts for all trackers |

---

## Tab 6 — Nutrition & Meals

**Purpose:** Deep dive into food tracking and nutritional analytics across all users.

### Content

#### Section 1 — Overview Cards
| Card | Value |
|------|-------|
| **Total Meals Logged** | Count of all `user_meals` documents |
| **Today's Meals** | Meals logged today |
| **Avg Daily Meals** | Per-user average (existing endpoint) |
| **Avg Daily Calories** | Per-user average (existing endpoint) |

#### Section 2 — Charts
| Chart | Type | Description |
|-------|------|-------------|
| **Top 10 Foods** | Bar chart | Most frequently logged meals (existing) |
| **Food Type Distribution** | Pie chart | Breakdown by `food_type` field |
| **Nutrient Trends** | Multi-line chart | Platform-wide daily average calories, protein, carbs, fat over time |
| **Meal Source Distribution** | Doughnut chart | `gemini` vs `ml_model` vs `text_prediction` source |
| **Meals Per Time of Day** | Bar chart | Breakfast / Lunch / Dinner / Snack distribution from `meal_datetime` |

#### Section 3 — Meal Browser
| Feature | Description |
|---------|-------------|
| **Searchable table** | Filter by food name, food type, user, date range |
| **Columns** | User name, meal name, food type, calories, carbs, protein, fat, added sugars, fiber, glycemic load, source, confidence %, date |
| **Expandable row** | Shows image, health assessment, recipes, ingredient nutrients |
| **Actions** | Delete meal (existing endpoint) |
| **Export** | CSV export with all nutrient columns |

#### Section 4 — Nutritional Alerts
| Alert Type | Condition |
|------------|-----------|
| **Extreme Calorie Days** | Users logging >3000 or <500 calories in a single day |
| **High Glycemic Load** | Users consistently exceeding glycemic load threshold |
| **Low Fiber Intake** | Users averaging <15g fiber daily |
| **High Added Sugars** | Users averaging >36g added sugars daily |

### Backend Endpoints Needed
| Status | Endpoint | Notes |
|--------|----------|-------|
| ✅ Exists | `GET /admin/meals/top-foods` | Top foods |
| ✅ Exists | `GET /admin/meals/averages` | Avg daily meals + calories |
| ✅ Exists | `GET /admin/users/<uid>/meals` | Per-user meals |
| ✅ Exists | `DELETE /admin/meals/<id>` | Delete meal |
| 🆕 New | `GET /admin/meals/stats` | Total meals, today's meals, food type distribution |
| 🆕 New | `GET /admin/meals/nutrient-trends` | Daily average nutrients over time |
| 🆕 New | `GET /admin/meals/source-distribution` | Count by analysis source |
| 🆕 New | `GET /admin/meals/time-distribution` | Meals grouped by time of day |
| 🆕 New | `GET /admin/meals/alerts` | Nutritional outlier alerts |
| 🆕 New | `GET /admin/meals/browse` | Paginated all-meals browser with filters |

---

## Tab 7 — Consultations & Telehealth

**Purpose:** Monitor all physician-patient consultations, appointments, and prescriptions.

### Content

#### Section 1 — Overview Cards
| Card | Value |
|------|-------|
| **Total Consultations** | All-time count |
| **Pending Requests** | `status == pending` |
| **In-Progress** | `status == in_progress` |
| **Completed** | `status == completed` |
| **Avg Rating** | Average consultation rating |

#### Section 2 — Consultations Table
| Column | Description |
|--------|-------------|
| **Patient** | Patient name + avatar |
| **Physician** | Physician name + specialization |
| **Status** | pending / approved / rejected / in_progress / completed / cancelled (color badges) |
| **Mode** | `quick_vitals` / `full_soap` |
| **Date** | Created date |
| **Rating** | Star rating (if completed) |
| **Actions** | View details |
| **Filters** | Status, physician, patient, date range |

#### Section 3 — Consultation Detail
- Full SOAP note content (subjective, objective, assessment, plan)
- Vitals: OGTT, fasting blood sugar, HbA1c
- Diagnosis and treatment plan
- Prescriptions issued during consultation
- Meeting link and password
- Follow-up status

#### Section 4 — Appointments
| Column | Description |
|--------|-------------|
| **Patient** | Name |
| **Physician** | Name |
| **Date & Time** | Scheduled slot |
| **Status** | pending / confirmed / cancelled / completed / rescheduled |
| **Reason** | Visit reason |
| **Actions** | View details |

#### Section 5 — Prescriptions
| Column | Description |
|--------|-------------|
| **Patient** | Name |
| **Physician** | Name |
| **Medication** | Name + dosage |
| **Frequency** | Dosing schedule |
| **Duration** | Days |
| **Refills** | Used / Allowed |
| **Status** | active / completed / cancelled / refill_requested |
| **Actions** | View details |

### Backend Endpoints Needed
| Status | Endpoint | Notes |
|--------|----------|-------|
| 🆕 New | `GET /admin/consultations/stats` | Counts by status, avg rating |
| 🆕 New | `GET /admin/consultations` | Paginated list with filters |
| 🆕 New | `GET /admin/consultations/<id>` | Full consultation detail + SOAP + prescriptions |
| 🆕 New | `GET /admin/appointments` | All appointments with filters |
| 🆕 New | `GET /admin/prescriptions` | All prescriptions with filters |

---

## Tab 8 — Chat & Communication

**Purpose:** Oversight of physician-patient messaging for compliance and support monitoring.

### Content

#### Section 1 — Overview Cards
| Card | Value |
|------|-------|
| **Total Conversations** | Count of `conversations` |
| **Active Conversations** | Conversations with messages in last 7 days |
| **Total Messages** | All messages count |
| **Avg Response Time** | Average physician response time to patient messages |

#### Section 2 — Conversations Table
| Column | Description |
|--------|-------------|
| **Participants** | Patient name ↔ Physician name |
| **Last Message** | Preview of latest message |
| **Last Activity** | Timestamp |
| **Message Count** | Total messages in conversation |
| **Status** | Active (recent) / Inactive |
| **Actions** | View conversation |

#### Section 3 — Conversation Viewer (read-only)
- Full message history with timestamps
- Image messages displayed
- Read receipts shown
- **Admin cannot send messages** — view-only for oversight

#### Section 4 — Communication Metrics
| Metric | Description |
|--------|-------------|
| **Messages per Day** | Line chart of daily message volume |
| **Top Communicators** | Most active physicians and patients |
| **Image Messages %** | Percentage of messages containing images |

### Backend Endpoints Needed
| Status | Endpoint | Notes |
|--------|----------|-------|
| 🆕 New | `GET /admin/chat/stats` | Conversation and message counts |
| 🆕 New | `GET /admin/chat/conversations` | Paginated conversation list |
| 🆕 New | `GET /admin/chat/conversations/<id>/messages` | Read-only message history |

---

## Tab 9 — AI & Chatbot

**Purpose:** Monitor AI service usage and health chatbot interactions.

### Content

#### Section 1 — Chatbot Analytics
| Card | Value |
|------|-------|
| **Total Chatbot Conversations** | Unique users who used chatbot |
| **Total Messages** | All chatbot messages |
| **Avg Messages Per User** | Engagement metric |
| **Active Today** | Users who used chatbot today |

| Chart | Type | Description |
|-------|------|-------------|
| **Daily Usage** | Line chart | Chatbot messages per day |
| **Peak Hours** | Bar chart | Messages by hour of day |

#### Section 2 — Recent Chatbot Conversations
- Table: User name, last message preview, total messages, last interaction time
- Expandable: full conversation history (user questions + AI responses)
- Flagging: conversations where chatbot mentioned "see a doctor" or emergency terms

#### Section 3 — Gemini AI Food Analysis Stats
| Card | Value |
|------|-------|
| **Image Analyses** | Total meals analyzed via image |
| **Text Analyses** | Total meals analyzed via text |
| **Avg Confidence** | Average `confidence_percentage` across analyses |
| **Low Confidence Scans** | Count of analyses with <50% confidence |

#### Section 4 — ML Model Status
| Item | Value |
|------|-------|
| **Nutrient Predictor (ResNet50)** | Status: Ready / Error / Loading |
| **Diabetes Risk Model** | Status: Ready / Error |
| **Gemini AI** | Status: Ready / Not Ready |
| **Groq LLM (Chatbot)** | Status: Ready / Error |

### Backend Endpoints Needed
| Status | Endpoint | Notes |
|--------|----------|-------|
| 🆕 New | `GET /admin/chatbot/stats` | Usage stats |
| 🆕 New | `GET /admin/chatbot/conversations` | Recent conversations grouped by user |
| 🆕 New | `GET /admin/ai/food-analysis-stats` | Gemini analysis counts + confidence |
| ✅ Exists | `GET /api/health` | Service status (adapt for admin display) |

---

## Tab 10 — System & Services

**Purpose:** System health monitoring, configuration, and operational tools.

### Content

#### Section 1 — Service Health
| Service | Status Check | Details |
|---------|-------------|---------|
| **MongoDB** | Connection alive | Database name, collections count |
| **Firebase Admin SDK** | Initialized | Auth verification working |
| **Gemini AI** | `is_ready()` check | Model name, status |
| **Groq LLM** | Service check | Model name, status |
| **ML Nutrient Predictor** | `is_model_ready()` | ResNet50 status, lazy load status |
| **Diabetes ML Model** | Model loaded check | Scikit-learn model status |
| **Cloudinary** | Config check | Cloud name, configured |
| **Email (Gmail SMTP)** | Config check | SMTP status |
| **Socket.IO** | Connected clients | Active WebSocket connections |

#### Section 2 — Database Statistics
| Metric | Description |
|--------|-------------|
| **Collection Sizes** | Document counts for all collections: users, physicians, user_meals, health_data, diabetes_assessments, conversations, messages, chatbot_messages, consultations, appointments, prescriptions, all tracker collections |
| **Index Status** | List of created indexes (sleep, alcohol, smoking, overall risk, chatbot) |
| **Data Growth** | Documents added per day (last 30 days chart) |

#### Section 3 — Platform Configuration
| Setting | Current Value |
|---------|---------------|
| **JWT Token Expiration** | 7 days |
| **Max Upload Size** | 10 MB |
| **Step Goal** | 10,000 steps |
| **Risk Score Weights** | initial_assessment: 0.35, food: 0.15, smoking: 0.13, sleep: 0.12, steps: 0.10, alcohol: 0.08, bmi: 0.05, age: 0.02, sex: 0.01 |
| **Data Confidence Thresholds** | <7d preliminary, 7-14d moderate, 14-30d good, 30d+ high |
| **Binge Thresholds** | 4 drinks (female), 5 drinks (male) |
| **Sleep Optimal Range** | 7–8 hours |

#### Section 4 — Logs & Errors
| Feature | Description |
|---------|-------------|
| **Recent Error Log** | Last 50 errors from `logs/app.log` |
| **Error Rate** | Errors per hour chart |
| **Slow Endpoints** | API response time monitoring |
| **Push Notification Stats** | FCM delivery stats (sent/failed) |

### Backend Endpoints Needed
| Status | Endpoint | Notes |
|--------|----------|-------|
| ✅ Exists | `GET /api/health` | Basic service health |
| 🆕 New | `GET /admin/system/health` | Extended health with all service statuses |
| 🆕 New | `GET /admin/system/database-stats` | Collection document counts |
| 🆕 New | `GET /admin/system/config` | Platform configuration values |
| 🆕 New | `GET /admin/system/logs` | Recent error logs |

---

## Implementation Priority

### Phase 1 — Core (Must Have)
1. **Dashboard** — stat cards + charts (leverage existing endpoints)
2. **User Management** — enhanced table with risk data + full drill-down
3. **Physician Management** — dedicated physician view

### Phase 2 — Clinical Intelligence
4. **Risk & Assessments** — population-level risk analytics
5. **Health Trackers** — aggregated tracker analytics
6. **Consultations & Telehealth** — consultation monitoring

### Phase 3 — Communication & AI
7. **Nutrition & Meals** — deep meal analytics (partially exists)
8. **Chat & Communication** — conversation oversight
9. **AI & Chatbot** — chatbot and AI monitoring

### Phase 4 — Operations
10. **System & Services** — system health and configuration

---

## Summary of New Backend Endpoints Required

| Category | New Endpoints | Priority |
|----------|--------------|----------|
| Dashboard | 4 | Phase 1 |
| User Management | 5 | Phase 1 |
| Physician Management | 7 | Phase 1 |
| Risk & Assessments | 6 | Phase 2 |
| Health Trackers | 6 | Phase 2 |
| Nutrition & Meals | 6 | Phase 2 |
| Consultations | 5 | Phase 2 |
| Chat | 3 | Phase 3 |
| AI & Chatbot | 3 | Phase 3 |
| System | 4 | Phase 4 |
| **Total** | **~49 new endpoints** | — |

---

## Existing Admin Features vs. What's Missing

### ✅ Already Implemented
- User list with search/filter/pagination
- User disable/enable with reason tracking
- Create physician accounts
- User stats cards (total, active, physicians, disabled)
- Registration analytics (line chart + pie chart)
- Per-user meal drill-down (card/list views with nutrition)
- Per-user sleep drill-down (baseline + records)
- Top foods chart
- Meal averages card
- CSV export for users and meals
- Firebase admin auth + protected routes

### ❌ Not Yet Implemented (High Value)
- Overall risk data anywhere in admin (the core purpose of the app)
- Physician professional details (specialization, license, patients, performance)
- Consultation/appointment monitoring
- Prescription oversight
- Smoking, alcohol, step tracker aggregation
- Diabetes assessment results viewer
- Chat/communication oversight
- AI/Chatbot usage analytics
- System health monitoring
- Component risk breakdown per user
- High-risk patient watchlist
- Trend prediction data
- Nutritional alerts
- Population-level health analytics
