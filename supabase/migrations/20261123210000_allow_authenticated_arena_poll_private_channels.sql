DROP POLICY IF EXISTS "authenticated users can read arena poll broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated users can send arena poll broadcasts" ON realtime.messages;

CREATE POLICY "authenticated users can read arena poll broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast'
  AND realtime.topic() LIKE 'arena-fan-poll-%'
);

CREATE POLICY "authenticated users can send arena poll broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension = 'broadcast'
  AND realtime.topic() LIKE 'arena-fan-poll-%'
);
