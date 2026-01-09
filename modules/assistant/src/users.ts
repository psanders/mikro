import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const USERS_FILE = resolve(__dirname, '../users.json');

export interface User {
  phone: string;
  referrerName?: string;
  name?: string;
  idNumber?: string;
  address?: string;
  currentJobPosition?: string;
  currentSalary?: string;
  idCardFrontReceived?: boolean;
  idCardBackReceived?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Users {
  [phone: string]: User;
}

export interface CreateUserData {
  phone: string;
  referrerName?: string;
  name?: string;
  address?: string;
  currentJobPosition?: string;
  currentSalary?: string;
  idCardFrontReceived?: boolean;
  idCardBackReceived?: boolean;
  idNumber?: string;
}

export interface UpdateUserData {
  name?: string;
  idNumber?: string;
}

/**
 * Load users from JSON file
 */
export function loadUsers(): Users {
  if (!existsSync(USERS_FILE)) {
    return {};
  }
  
  try {
    const content = readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(content) as Users;
  } catch (error) {
    console.error('Error loading users:', error);
    return {};
  }
}

/**
 * Save users to JSON file
 */
export function saveUsers(users: Users): void {
  try {
    writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving users:', error);
    throw error;
  }
}

/**
 * Check if a user exists by phone number
 */
export function userExists(phone: string): boolean {
  const users = loadUsers();
  return phone in users;
}

/**
 * Get user by phone number
 */
export function getUser(phone: string): User | null {
  const users = loadUsers();
  return users[phone] || null;
}

/**
 * Create a new user
 */
export function createUser(userData: CreateUserData): User {
  const users = loadUsers();
  const { phone, referrerName, name, address, currentJobPosition, currentSalary, idCardFrontReceived, idCardBackReceived, idNumber } = userData;
  
  if (!phone) {
    throw new Error('Phone number is required');
  }
  
  if (users[phone]) {
    throw new Error('User already exists');
  }
  
  users[phone] = {
    phone,
    referrerName,
    name,
    idNumber: idNumber || '',
    address,
    currentJobPosition,
    currentSalary,
    idCardFrontReceived: idCardFrontReceived || false,
    idCardBackReceived: idCardBackReceived || false,
    createdAt: new Date().toISOString()
  };
  
  saveUsers(users);
  return users[phone];
}

/**
 * Update user information (for updating name/ID from ID card)
 */
export function updateUser(phone: string, updates: UpdateUserData): User {
  const users = loadUsers();
  
  if (!users[phone]) {
    throw new Error('User does not exist');
  }
  
  // Update allowed fields
  if (updates.name !== undefined) {
    users[phone].name = updates.name;
  }
  if (updates.idNumber !== undefined) {
    users[phone].idNumber = updates.idNumber;
  }
  
  users[phone].updatedAt = new Date().toISOString();
  
  saveUsers(users);
  return users[phone];
}
