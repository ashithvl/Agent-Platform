-- Bootstrap databases + roles for the whole stack.
-- The auth-service + api-service + agent-service + knowledge-service live in `eai`.
-- Langfuse and LiteLLM each get their own database so their managed migrations
-- (Prisma diff in LiteLLM, Drizzle in Langfuse) never touch our app tables.
CREATE DATABASE eai;
CREATE DATABASE langfuse;
CREATE DATABASE litellm;
