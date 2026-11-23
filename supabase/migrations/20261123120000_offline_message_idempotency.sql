ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS direct_messages_client_request_id_uidx
  ON public.direct_messages (client_request_id)
  WHERE client_request_id IS NOT NULL;

ALTER TABLE public.chat_group_messages
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS chat_group_messages_client_request_id_uidx
  ON public.chat_group_messages (client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN public.direct_messages.client_request_id IS
  'Client-generated idempotency key used to safely retry text messages queued while offline.';

COMMENT ON COLUMN public.chat_group_messages.client_request_id IS
  'Client-generated idempotency key used to safely retry text messages queued while offline.';
