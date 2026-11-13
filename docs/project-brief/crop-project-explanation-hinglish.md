# AI-Based Crop Disease & Pest Early Detection System

Status: planned product explanation, not a claim of a completed deployment. Working title only. Prepared 13 November 2026.

## Spoken script

Estimated 60-90 seconds at a natural presentation pace; rehearse once for your own delivery. Section labels and the separate internal overview are not spoken.

### 1. Kisan ki kahani

Sochiye, Ramesh ji subah khet mein tamatar ke patton par daag dekhte hain. Unhe samajh nahi aata ki bimari hai ya koi aur dikkat. Expert tak pahunchne mein waqt lagta hai, aur galat dawa ka kharcha bhi ho sakta hai.

### 2. Hum kya bana rahe hain

Hum ek simple AI farming assistant bana rahe hain. Kisan mobile number aur OTP se login karega, fasal chunega aur patte ki photo lega. Naam aur baaki profile baad mein bhi bhar sakta hai.

### 3. Yeh kaise kaam karega

AgriSmart AI photo se fasal ki sehat ka shuruati andaza dega. Weather API local mausam batayegi. Recommendation system verified kheti ki jaankari layega. Generative AI use aasaan bhasha mein samjhayega, aur Vapi se kisan apni pasand ki bhasha mein baat kar sakega.

### 4. Technology ka role

Next.js app ko simple rakhega aur Python FastAPI AI model chalayega. Data, voice aur deployment ke liye alag services hongi; kisan ko inki complexity nahi dikhegi.

### 5. Hamara maksad

Maksad hai sahi waqt par madad aur bina zaroorat pesticide ke istemal ko kam karne mein sahayata. AI sirf shuruati guidance dega; yeh krishi expert ya laboratory confirmation ki jagah nahi lega.

### 6. Aakhri baat

Samajhdaar fasal ki dekhbhal, har kisan ki pahunch mein.

## Internal technical overview - not spoken

| Technology | Planned responsibility |
|---|---|
| Next.js 16 + shadcn/ui | Mobile-first farmer web flow, separate protected admin portal and secure API gateway |
| Python FastAPI | Private, bounded image-inference service inside `/ai`; application business logic stays in `/backend` |
| AgriSmart India v1 | Candidate photo classifier: 59 crops / 387 classes; checksum pinned, runtime and field validation still needed |
| PostgreSQL + Prisma | Durable farmer, farm, diagnosis, approved-guidance and consent records |
| Redis | OTP throttling, short-lived state and weather cache; actual runtime adapter still to implement |
| Open-Meteo | Local current/forecast weather context; no trained outbreak probability model |
| LangGraph + LangChain | Controlled tool workflow and grounded explanations; no direct agent database access |
| Vapi | Voice transport and selected-language interaction through authenticated, owner-scoped tools |
| Docker / Kubernetes | Docker for reproducible local services; Kubernetes only in a later deployment phase |

Flow: photo -> private inference -> weather context + approved knowledge -> simple explanation -> optional voice/expert review.

Review gates: model/dataset licence, local field performance, supported languages, verified agricultural guidance, OTP/admin security and privacy/retention. Upstream advice/translations are drafts. No fabricated accuracy, disease probability, treatment or successful-deployment claims.

Sources for internal preparation: [upstream model](https://github.com/wpzvqrs8/SIH_2026/tree/9db1605a7c9fdc989f51320ae4970f6a1d8fd255/model/india), [weather API](https://open-meteo.com/en/docs), [Vapi server authentication](https://docs.vapi.ai/server-url/server-authentication), and the shared [project planning pack](../project-planning/README.md).
