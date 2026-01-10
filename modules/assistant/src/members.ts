import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { getGoogleSheetsConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMBERS_FILE = resolve(__dirname, '../members.json');

export interface Member {
  phone: string;
  referrerName?: string;
  name?: string;
  idNumber?: string;
  address?: string;
  currentJobPosition?: string;
  currentSalary?: string;
  isBusinessOwner?: boolean;
  monthsInBusiness?: number;
  idCardFrontReceived?: boolean;
  idCardBackReceived?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Members {
  [phone: string]: Member;
}

export interface CreateMemberData {
  phone: string;
  referrerName?: string;
  name?: string;
  address?: string;
  currentJobPosition?: string;
  currentSalary?: string;
  isBusinessOwner?: boolean;
  monthsInBusiness?: number;
  idCardFrontReceived?: boolean;
  idCardBackReceived?: boolean;
  idNumber?: string;
}

export interface UpdateMemberData {
  name?: string;
  idNumber?: string;
}

/**
 * Load members from JSON file
 */
export function loadMembers(): Members {
  if (!existsSync(MEMBERS_FILE)) {
    return {};
  }
  
  try {
    const content = readFileSync(MEMBERS_FILE, 'utf-8');
    return JSON.parse(content) as Members;
  } catch (error) {
    console.error('Error loading members:', error);
    return {};
  }
}

/**
 * Save members to JSON file
 */
export function saveMembers(members: Members): void {
  try {
    writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving members:', error);
    throw error;
  }
}

/**
 * Check if a member exists by phone number
 */
export function memberExists(phone: string): boolean {
  const members = loadMembers();
  return phone in members;
}

/**
 * Get member by phone number
 */
export function getMember(phone: string): Member | null {
  const members = loadMembers();
  return members[phone] || null;
}

/**
 * Create a new member
 */
export async function createMember(memberData: CreateMemberData): Promise<Member> {
  const members = loadMembers();
  const { phone, referrerName, name, address, currentJobPosition, currentSalary, isBusinessOwner, monthsInBusiness, idCardFrontReceived, idCardBackReceived, idNumber } = memberData;
  
  if (!phone) {
    throw new Error('Phone number is required');
  }
  
  if (members[phone]) {
    throw new Error('Member already exists');
  }
  
  const member: Member = {
    phone,
    referrerName,
    name,
    idNumber: idNumber || '',
    address,
    currentJobPosition,
    currentSalary,
    isBusinessOwner: isBusinessOwner || false,
    monthsInBusiness,
    idCardFrontReceived: idCardFrontReceived || false,
    idCardBackReceived: idCardBackReceived || false,
    createdAt: new Date().toISOString()
  };
  
  members[phone] = member;
  saveMembers(members);
  
  // Add to Google Sheets if configured
  try {
    await addMemberToGoogleSheets(member);
  } catch (error) {
    // Log error but don't fail the member creation
    console.error('Error adding member to Google Sheets:', error);
  }
  
  return member;
}

/**
 * Update member information (for updating name/ID from ID card)
 */
export function updateMember(phone: string, updates: UpdateMemberData): Member {
  const members = loadMembers();
  
  if (!members[phone]) {
    throw new Error('Member does not exist');
  }
  
  // Update allowed fields
  if (updates.name !== undefined) {
    members[phone].name = updates.name;
  }
  if (updates.idNumber !== undefined) {
    members[phone].idNumber = updates.idNumber;
  }
  
  members[phone].updatedAt = new Date().toISOString();
  
  saveMembers(members);
  return members[phone];
}

/**
 * Add member to Google Sheets
 */
async function addMemberToGoogleSheets(member: Member): Promise<void> {
  const config = getGoogleSheetsConfig();
  
  // Skip if Google Sheets is not configured
  if (!config.enabled) {
    return;
  }
  
  try {
    // Authenticate with Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: config.credentials!,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Check if sheet is empty and add headers if needed
    // Google Sheets API requires single quotes around sheet names with spaces
    // Format: 'Sheet Name'!A1:L1
    const headerRange = config.sheetName.includes(' ') 
      ? `'${config.sheetName.replace(/'/g, "''")}'!A1:L1`
      : `${config.sheetName}!A1:L1`;
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: headerRange,
    });
    
    const existingHeaders = headerResponse.data.values;
    if (!existingHeaders || existingHeaders.length === 0) {
      // Add headers
      const headers = [
        'Created At',
        'Phone',
        'Name',
        'ID Number',
        'Referred By',
        'Address',
        'Job Position',
        'Salary',
        'Is Business Owner',
        'Months in Business',
        'ID Card Front Received',
        'ID Card Back Received',
      ];
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: config.spreadsheetId,
        range: headerRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers],
        },
      });
      
      console.log('Headers added to Google Sheet');
    }
    
    // Helper function to format date as YYYY-MM-DD (date only, no time)
    const formatDate = (isoString: string): string => {
      return isoString.split('T')[0];
    };
    
    // Prepare row data
    const row = [
      formatDate(member.createdAt),
      member.phone,
      member.name || '',
      member.idNumber || '',
      member.referrerName || '',
      member.address || '',
      member.currentJobPosition || '',
      member.currentSalary || '',
      member.isBusinessOwner ? 'Yes' : 'No',
      member.monthsInBusiness?.toString() || '',
      member.idCardFrontReceived ? 'Yes' : 'No',
      member.idCardBackReceived ? 'Yes' : 'No',
    ];
    
    // Append row to the sheet
    // For append operations, use the sheet name directly (API handles spaces)
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.spreadsheetId,
      range: config.sheetName,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
    
    console.log('Member added to Google Sheets successfully');
  } catch (error) {
    const err = error as Error;
    console.error('Error adding member to Google Sheets:', err.message);
    throw err;
  }
}
