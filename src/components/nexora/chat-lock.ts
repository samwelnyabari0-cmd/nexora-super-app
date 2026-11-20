export type ChatLockKind = "direct" | "group";

export function isValidDeviceLockCode(code: string): boolean {
  return code.length >= 8 && code.length <= 32 && !/^\s+$/.test(code);
}

export function chatLockStorageKey(userId: string, chatKind: ChatLockKind, chatId: string): string {
  return `nexora:chat-lock:v1:${encodeURIComponent(userId)}:${chatKind}:${encodeURIComponent(chatId)}`;
}

export function constantTimeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
