# Privacy

The MVP is local-first and does not include analytics or cloud sync. Provider lookups are enabled
by default but occur only when explicitly invoked; credentials are environment configuration and
never committed. Medication reference searches use NIH/NLM RxNorm and send only the search term.
Returned reference metadata is saved locally only when the user chooses to use it in a medication
schedule. An explicit saved opt-out remains respected.

Wellbeing observations, journal/reflection content, medication information, symptoms, and life events
are exceptionally sensitive. They remain local unless the user explicitly grants the specific future
scope involved. Consent scopes are separate for cloud sync, general AI, AI access to sensitive data,
cross-domain analysis, and health-data import; consent is revocable and never inferred from another
setting.

Identity-related profile fields—including sex assigned at birth, gender identity, and pronouns—are
optional and should not be repurposed as analytics labels. Sex assigned at birth may provide a
technical equation default, but that derived use must remain transparent and separate from identity.

Future privacy work must include transparent data destinations, export, deletion, retention controls,
and a security review before sync, AI processing, notifications, integrations, or telemetry are
enabled. Crisis/safety resources should be configurable by region rather than hardcoded around one
country. No regulatory compliance is claimed by this project.
