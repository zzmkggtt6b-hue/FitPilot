# FitPilot

AI-powered personal fitness coach, initially delivered through Telegram and designed to evolve into a Telegram Mini App.

## Project Overview

FitPilot is an AI fitness coach that starts as a Telegram Bot and later expands into a Telegram Mini App. The coach communicates naturally, collects a structured fitness profile through conversational onboarding, and progressively adds personalized training, nutrition, progress tracking, habits, lifestyle guidance, and adaptive coaching.

Core capabilities:
- Natural-language onboarding and profile extraction
- Personalized gym and home workouts
- Training schedules, exercises, progression, and substitutions
- Nutrition and diet guidance
- Progress and adherence tracking
- Multi-language conversations
- Scientific knowledge base and retrieval-augmented generation (RAG)
- Safety-aware coaching and professional-referral boundaries

## Product Vision

FitPilot should feel like a personal AI coach inside Telegram rather than a rigid questionnaire. Users can answer naturally, for example:

> “I'm 27, 181 cm and around 82 kilos.”

The system extracts structured information from natural language, identifies missing information, asks only relevant follow-up questions, and keeps the conversation flexible.

## Product Principles

### Personalization

Recommendations should account for:
- Age
- Sex/gender where relevant
- Height and weight
- Training experience, frequency, and available time
- Gym, home, or both
- Available equipment
- Goals, preferences, and restrictions
- Lifestyle and recovery factors

### Scientific Foundation

FitPilot must use credible evidence and professional guidelines. The LLM is **not** the scientific source of truth.

Target flow:

**Scientific Sources → Knowledge Base → AI reasoning/retrieval → Personalized recommendation → User**

Important claims and recommendations should be traceable to supporting sources.

### Safety

FitPilot is a fitness coach, not a doctor. It must avoid diagnosis and unsupported medical advice, recommend qualified professionals when appropriate, ask relevant safety questions, and avoid unsupported claims.

### Privacy

Fitness and lifestyle information can be sensitive. Collect only information necessary for the product and protect it with appropriate access controls, validation, and data-minimization practices.

## High-Level Architecture

```text
Telegram
   ↓
Telegram Bot API
   ↓
Vercel Backend
   ↓
Conversation Engine / AI LLM Layer
   ↓
Supabase / Knowledge Base
   ↓
Personalized Coach
   ↓
Telegram
```

Later, the Telegram Bot and Telegram Mini App should share the same backend and business logic.

## Technology Stack

- **GitHub** — source control, versioning, issues, project management, documentation, CI/CD, and development workflow.
- **Vercel** — backend/API, web and Mini App hosting, server-side AI, deployment, and environment configuration. Use modern Next.js App Router where applicable.
- **Supabase** — PostgreSQL database, profiles, onboarding, conversations, training, nutrition, progress, knowledge metadata, generation records, preferences, authentication, and Row Level Security (RLS). Supabase is the structured source of truth.
- **Telegram** — initial Bot interface and future Mini App interface.
- **AI/LLM** — natural-language understanding, onboarding extraction, missing-information detection, contextual reasoning, recommendations, multilingual communication, and evidence-aware responses. The model must not invent scientific or medical claims.

## Development Phases

### Phase 0 — Product & Architecture Foundation

Define:
- Product vision and target users
- MVP scope
- Onboarding questions
- Profile and training data
- Goals and safety information
- Language support
- Database architecture
- AI behavior
- Scientific evidence strategy
- Privacy requirements
- Telegram integration
- Deployment architecture

Deliverables:
- PRD
- Architecture document
- Database schema
- Onboarding specification
- AI behavior specification
- Safety specification
- Evidence strategy

### Phase 1 — Telegram Onboarding MVP

The first MVP focuses **only on onboarding**. No personalized training plans yet.

Flow:

`/start` → Welcome → Language → Consent/privacy → Basic profile → Fitness experience → Training environment → Availability → Goals → Preferences/restrictions → Profile summary → Confirmation → Complete

Onboarding must support natural-language extraction and must not behave like a rigid questionnaire.

Information to collect includes:
- Age
- Sex/gender where relevant
- Height
- Weight
- Training experience and activity level
- Gym/home/both
- Days per week
- Session duration
- Preferred days/time
- Goals such as muscle gain, fat loss, strength, general fitness, recomposition, or endurance
- Preferences, equipment, and restrictions

#### Onboarding State Machine

```text
NOT_STARTED
    ↓
LANGUAGE
    ↓
BASIC_PROFILE
    ↓
FITNESS_PROFILE
    ↓
TRAINING_PROFILE
    ↓
GOALS
    ↓
PREFERENCES
    ↓
REVIEW
    ↓
COMPLETED
```

Users must be able to stop, resume, correct, go back, ask questions, change language, and restart. The AI should distinguish between an answer, question, correction, change request, and general conversation.

#### Phase 1 Database Entities

- `users`
- `profiles`
- `onboarding_sessions`
- `onboarding_answers`
- `user_preferences`
- `training_profiles`
- `fitness_goals`
- `conversation_messages`

The exact schema should be defined before implementation, including RLS policies.

#### Phase 1 Success Criteria

- User can start the bot
- Language is detected/selected
- Conversational onboarding works
- Natural-language data is extracted
- Structured data is stored in Supabase
- Corrections and resume work
- User receives a profile summary
- User confirms the profile
- Onboarding reaches `COMPLETED`
- No full training or diet plans are generated yet

### Phase 2 — Personalized Fitness Coach

Use the structured profile to generate personalized training recommendations, including:
- Schedule
- Frequency
- Duration
- Exercises
- Sets and reps
- Rest periods
- Intensity
- Progression
- Substitutions
- Gym/home adaptations

Avoid arbitrary LLM-only workouts. Combine user data, deterministic training rules, scientific evidence, safety constraints, and LLM reasoning/presentation.

### Phase 3 — Scientific Knowledge System

Knowledge categories should include:
- Resistance training
- Hypertrophy
- Strength
- Programming
- Volume and frequency
- Recovery and sleep
- Energy balance
- Protein, carbohydrates, fats, and micronutrients
- Weight management
- Sports nutrition
- Exercise safety

#### Source Hierarchy

Prefer:
1. Systematic reviews and meta-analyses
2. Randomized controlled trials
3. Professional position stands and guidelines
4. Government/public-health sources
5. Scientific organizations

Avoid relying on random blogs as authoritative evidence.

#### RAG Flow

```text
User
 ↓
Profile
 ↓
Question / Goal
 ↓
Retrieve Evidence
 ↓
AI Reasoning
 ↓
Safety
 ↓
Personalization
 ↓
Response
```

For important recommendations, retain the relevant sources/references. For example, protein-target recommendations should be evidence-aware and contextualized rather than invented by the model.

### Phase 4 — Personalized Nutrition / Diet

After training functionality is established, add:
- Calorie estimates
- Calorie/protein/carb/fat targets
- Meal structure
- Dietary preferences and restrictions
- Meal suggestions
- Grocery suggestions
- Adjustments over time

Clearly distinguish estimates from medical advice. Do not diagnose or provide treatment.

### Phase 5 — Progress Tracking

Track training data such as:
- Completed workouts
- Exercises
- Sets and reps
- Weight used
- RPE/RIR
- Duration

Optional body metrics:
- Weight
- Measurements
- Progress photos

Also track goals and adherence. AI should provide feedback, trends, and appropriate adjustments.

### Phase 6 — Advanced AI Coach

Add:
- Weekly check-ins
- Reminders
- Progress reviews
- Program adjustments
- Recovery monitoring
- Goal reviews
- Adherence support
- Encouragement
- Long-term coaching

Example capability: proactively identify a pattern of poor recovery or missed sessions and suggest a reasonable adjustment while respecting safety boundaries.

### Phase 7 — Telegram Mini App

Add a graphical interface using the same backend and business logic.

Planned areas:
- Dashboard
- Profile
- Training
- Today
- Weekly plan
- Exercises
- Nutrition
- Daily target
- Meals
- Progress
- Coach Chat
- Settings

## Multi-Language Support

The architecture should support multilingual users from the beginning:

**User language → AI reasoning → structured data → response generation**

Structured values must be language-independent. Example:

```json
{
  "goal": "muscle_gain"
}
```

Initial language targets may include Dutch, English, Spanish, French, German, and additional languages as the product grows.

## AI Architecture

Logical components:

- **Conversation Manager** — controls conversational flow and context.
- **Profile Manager** — extracts, validates, updates, and persists structured profile data.
- **Knowledge Retrieval** — retrieves relevant scientific evidence.
- **Recommendation Engine** — combines user context, deterministic rules, evidence, and constraints.
- **Safety Layer** — classifies risk and enforces safety boundaries.
- **Response Layer** — turns structured reasoning into clear, natural, multilingual responses.

The LLM should primarily provide reasoning, language understanding, and communication. Deterministic business logic should be used wherever practical.

## Data Architecture

```text
User
 ├── Profile
 ├── Goals
 ├── Training Profile
 ├── Preferences
 ├── Conversations
 ├── Training Plans
 ├── Workout History
 ├── Nutrition Plans
 └── Progress
```

Supabase is the source of truth. The LLM conversation is not the database.

## Conversation Architecture

Use two context layers:

- **Short-term context** — recent conversation needed to maintain continuity.
- **Long-term context** — structured profile, goals, preferences, training history, and other durable facts.

Only relevant context should be supplied for a given task.

## Safety Layer

Safety flow:

```text
User Input
 ↓
Safety Classification
 ↓
In Scope?
 ├── Yes → Coach Advice
 └── No → Safe Response / Professional Referral
```

Safety rules should cover, at minimum:
- Injuries
- Medical conditions
- Eating disorders
- Pregnancy
- Medication questions
- Severe symptoms
- Extreme dieting
- Unsafe exercise
- Dangerous weight-loss requests

The safety system should be conservative when uncertainty is high.

## Scientific Evidence Governance

Important recommendations should retain metadata such as:
- Recommendation
- Evidence level
- Source
- Publication date
- Topic
- Applicable population

The system should be able to explain why a recommendation was made and support periodic review and updating of the evidence base.

## Testing

### Unit Tests

Cover:
- Calculations
- Profile parsing
- Goal classification
- Validation
- Safety logic

### Integration Tests

Test the complete path:

`Telegram → Backend → AI → Supabase`

### AI Evaluation Dataset

Include cases covering:
- Normal onboarding
- Ambiguous answers
- Multilingual input
- Corrections
- Missing information
- Safety scenarios
- Unusual requests

Repeat evaluation when prompts, models, or business logic change.

## Security

- Never expose the Supabase service-role key to clients.
- Enforce RLS.
- Validate Telegram identity.
- Perform server-side input validation.
- Store secrets in environment variables.
- Minimize personal data.
- Log carefully and avoid unnecessary sensitive conversation data.
- Maintain clear development/production separation.

## Repository Structure

```text
ai-fitness-coach/
├── app/
│   ├── api/
│   ├── telegram/
│   └── mini-app/
├── components/
├── lib/
│   ├── ai/
│   ├── telegram/
│   ├── supabase/
│   ├── coaching/
│   ├── nutrition/
│   ├── safety/
│   └── knowledge/
├── supabase/
│   ├── migrations/
│   └── seed/
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── onboarding/
│   ├── ai/
│   ├── science/
│   └── safety/
├── tests/
├── README.md
└── package.json
```

## Recommended MVP Strategy

- **MVP1:** Telegram → AI onboarding → structured profile → Supabase only
- **MVP2:** Completed profile → personalized training
- **MVP3:** Training + scientific knowledge + personalization
- **MVP4:** Training + nutrition + progress
- **MVP5:** Full AI coach + proactive coaching + adaptation
- **MVP6:** Bot + Telegram Mini App

## Roadmap

| Phase | Functionality | Priority |
|---|---|---|
| 0 | Product & architecture | Critical |
| 1 | Telegram onboarding | Critical |
| 2 | Personalized training | High |
| 3 | Scientific knowledge / RAG | High |
| 4 | Nutrition / diet | High |
| 5 | Progress tracking | Medium |
| 6 | Advanced AI coaching | Medium |
| 7 | Telegram Mini App | Later |

## Definition of Done

A feature is considered done when:

- Functionality works as intended
- Database changes are stable and documented
- Security has been reviewed
- Error handling is implemented
- Tests pass
- AI behavior has been evaluated where applicable
- Documentation is updated
- Deployment works
- An end-to-end demo is possible

## Long-Term Vision

```text
Telegram Chatbot
      ↓
Personal AI Fitness Coach
      ├── Conversational AI
      ├── Personal User Profile
      ├── Scientific Knowledge
      ├── Training Engine
      ├── Nutrition Engine
      ├── Progress Tracking
      ├── Adaptive Coaching
      └── Telegram Mini App
```

The core principle is that the **LLM is the intelligence and communication layer** — not the database, not the scientific source of truth, and not the sole safety-critical decision maker.

FitPilot should combine structured data, deterministic logic, scientific evidence, safety controls, and AI reasoning to create a useful, trustworthy, and adaptive personal fitness coach.
