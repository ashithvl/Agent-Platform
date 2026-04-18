-- Bootstrap databases + roles for the whole stack.
-- The auth-service + api-service + agent-service all live in `eai`.
-- Langfuse gets its own database so its schema migrations never touch ours.
CREATE DATABASE eai;
CREATE DATABASE langfuse;
