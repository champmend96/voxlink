export async function getExpoPushTokenAsync() {
  return { data: "ExponentPushToken[mock-token]" };
}

export async function getPermissionsAsync() {
  return { status: "granted" };
}

export async function requestPermissionsAsync() {
  return { status: "granted" };
}

export function setNotificationHandler() {}

export function addNotificationReceivedListener() {
  return { remove: jest.fn() };
}

export function addNotificationResponseReceivedListener() {
  return { remove: jest.fn() };
}
