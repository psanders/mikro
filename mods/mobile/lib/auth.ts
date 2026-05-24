/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "mikro_jwt";
const PIN_KEY = "mikro_pin";
const NAME_KEY = "mikro_user_name";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getPin(): Promise<string | null> {
  return SecureStore.getItemAsync(PIN_KEY);
}

export async function setPin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
}

export async function getUserName(): Promise<string | null> {
  return SecureStore.getItemAsync(NAME_KEY);
}

export async function setUserName(name: string): Promise<void> {
  await SecureStore.setItemAsync(NAME_KEY, name);
}

export async function clearUserName(): Promise<void> {
  await SecureStore.deleteItemAsync(NAME_KEY);
}
