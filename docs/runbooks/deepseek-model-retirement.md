# DeepSeek renames or retires a model

The AI chat is optional and isolated: without a working key/model the route
returns 503 and the rest of the app is unaffected.

## Symptom

- `/app/chat` answers with an error instead of a reply.
- `docker compose logs web | grep -i deepseek` shows a 4xx from the provider,
  usually "model not found" or "invalid model".

## Steps

1. Confirm the configured model:

   ```bash
   grep DEEPSEEK_ .env
   ```

   `DEEPSEEK_MODEL` (fast lane) and `DEEPSEEK_PRO_MODEL` (pro lane) are the two
   that matter.

2. Ask the provider which model ids are current (their `/models` endpoint or
   docs). Do not guess a name.

3. Update `.env`:

   ```bash
   DEEPSEEK_MODEL="<current-id>"
   DEEPSEEK_PRO_MODEL="<current-id>"
   ```

   If the base URL changed, update `DEEPSEEK_BASE_URL` too.

4. Recreate web (the route reads env at request time, but the container was
   started with the old values):

   ```bash
   docker compose up -d --no-deps --force-recreate web
   ```

5. If no current model is affordable or suitable, disable AI by clearing the
   key:

   ```bash
   DEEPSEEK_API_KEY=""
   ```

   The route then returns 503 and the chat page shows its "disabled" state.

## How you know it worked

- `/app/chat` answers a simple question.
- `docker compose logs --tail=50 web` has no 4xx from the provider.

## Notes

- The route is single-turn, non-streaming, and does not persist messages, so
  there is no stored data to migrate.
- No other feature depends on DeepSeek; the rest of the app never blocks on it.
