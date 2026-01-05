/**
 * Roster Layout & Eligibility Utilities
 *
 * Provides data-driven grid layout and slot eligibility rules for fantasy hockey rosters.
 */

import type { RosterPlayer } from './coachSchemas';

export type SlotType = 'C' | 'LW' | 'RW' | 'D' | 'G' | 'F' | 'UTIL' | 'BN' | 'IR' | 'IR+';

export interface RosterSlot {
  id: string;           // "LW-0", "C-1", "UTIL-2", etc.
  type: SlotType;       // "LW", "C", "F", etc.
  index: number;        // 0, 1, 2...
  displayName: string;  // "LW", "C 1", "F", "UTIL", etc.
}

export interface RosterRow {
  rowType: 'forwards' | 'forward-flex' | 'skater-flex' | 'defense' | 'goalies' | 'bench' | 'ir';
  slots: RosterSlot[];
  columns: number; // How many columns this row should span
}

/**
 * Check if a player is eligible for a specific slot
 */
export function canDrop(player: RosterPlayer | any, slotType: SlotType): boolean {
  // Handle both RosterPlayer (positions) and PlayerSearchResult (pos)
  const positionsField = (player as any).positions || (player as any).pos || [];
  const positions = Array.isArray(positionsField) ? positionsField : [];

  switch (slotType) {
    // Exact position matches
    case 'C':
      return positions.includes('C');
    case 'LW':
      return positions.includes('LW') || positions.includes('L');
    case 'RW':
      return positions.includes('RW') || positions.includes('R');
    case 'D':
      return positions.includes('D');
    case 'G':
      return positions.includes('G');

    // Flex positions
    case 'F':
      // Forward: any of C, LW, RW
      return positions.some(p => ['C', 'LW', 'L', 'RW', 'R'].includes(p));

    case 'UTIL':
      // Utility: any skater (not goalies)
      return positions.some(p => ['C', 'LW', 'L', 'RW', 'R', 'D'].includes(p));

    // Universal slots
    case 'BN':
      // Bench accepts anyone
      return true;

    case 'IR':
    case 'IR+':
      // IR soft mode: allow any player
      return true;

    default:
      return false;
  }
}

/**
 * Build roster rows from lineup_slots configuration
 */
export function buildRosterRows(lineup_slots: Record<string, number>): RosterRow[] {
  const rows: RosterRow[] = [];

  // Extract counts
  const LW = lineup_slots['LW'] || 0;
  const C = lineup_slots['C'] || 0;
  const RW = lineup_slots['RW'] || 0;
  const D = lineup_slots['D'] || 0;
  const G = lineup_slots['G'] || 0;
  const F = lineup_slots['F'] || 0;
  const UTIL = lineup_slots['UTIL'] || 0;
  const BN = lineup_slots['BN'] || 0;
  const IR = lineup_slots['IR'] || 0;
  const IR_PLUS = lineup_slots['IR+'] || 0;

  // 1. Forwards rail (LW-C-RW grid, 3 columns)
  const maxForwardRows = Math.max(LW, C, RW);
  if (maxForwardRows > 0) {
    for (let row = 0; row < maxForwardRows; row++) {
      const slots: RosterSlot[] = [];

      if (row < LW) {
        slots.push({
          id: `LW-${row}`,
          type: 'LW',
          index: row,
          displayName: LW === 1 ? 'LW' : `LW ${row + 1}`
        });
      }

      if (row < C) {
        slots.push({
          id: `C-${row}`,
          type: 'C',
          index: row,
          displayName: C === 1 ? 'C' : `C ${row + 1}`
        });
      }

      if (row < RW) {
        slots.push({
          id: `RW-${row}`,
          type: 'RW',
          index: row,
          displayName: RW === 1 ? 'RW' : `RW ${row + 1}`
        });
      }

      rows.push({
        rowType: 'forwards',
        slots,
        columns: 3
      });
    }
  }

  // 2. Forward Flex (F) - laid left→right on 3-col grid
  if (F > 0) {
    const flexSlots: RosterSlot[] = [];
    for (let i = 0; i < F; i++) {
      flexSlots.push({
        id: `F-${i}`,
        type: 'F',
        index: i,
        displayName: F === 1 ? 'F' : `F ${i + 1}`
      });
    }

    // Chunk into rows of 3
    for (let i = 0; i < flexSlots.length; i += 3) {
      rows.push({
        rowType: 'forward-flex',
        slots: flexSlots.slice(i, i + 3),
        columns: 3
      });
    }
  }

  // 3. Skater Flex (UTIL) - laid left→right on 3-col grid
  if (UTIL > 0) {
    const utilSlots: RosterSlot[] = [];
    for (let i = 0; i < UTIL; i++) {
      utilSlots.push({
        id: `UTIL-${i}`,
        type: 'UTIL',
        index: i,
        displayName: UTIL === 1 ? 'UTIL' : `UTIL ${i + 1}`
      });
    }

    // Chunk into rows of 3
    for (let i = 0; i < utilSlots.length; i += 3) {
      rows.push({
        rowType: 'skater-flex',
        slots: utilSlots.slice(i, i + 3),
        columns: 3
      });
    }
  }

  // 4. Defense rail (D, 2 columns)
  if (D > 0) {
    const dSlots: RosterSlot[] = [];
    for (let i = 0; i < D; i++) {
      dSlots.push({
        id: `D-${i}`,
        type: 'D',
        index: i,
        displayName: D === 1 ? 'D' : `D ${i + 1}`
      });
    }

    // Chunk into rows of 2
    for (let i = 0; i < dSlots.length; i += 2) {
      rows.push({
        rowType: 'defense',
        slots: dSlots.slice(i, i + 2),
        columns: 2
      });
    }
  }

  // 5. Goalies rail (G, 1 column, centered)
  if (G > 0) {
    for (let i = 0; i < G; i++) {
      rows.push({
        rowType: 'goalies',
        slots: [{
          id: `G-${i}`,
          type: 'G',
          index: i,
          displayName: G === 1 ? 'G' : `G ${i + 1}`
        }],
        columns: 1
      });
    }
  }

  // 6. Bench (BN, wrap every 4)
  if (BN > 0) {
    const bnSlots: RosterSlot[] = [];
    for (let i = 0; i < BN; i++) {
      bnSlots.push({
        id: `BN-${i}`,
        type: 'BN',
        index: i,
        displayName: BN === 1 ? 'BN' : `BN ${i + 1}`
      });
    }

    // Chunk into rows of 4
    for (let i = 0; i < bnSlots.length; i += 4) {
      rows.push({
        rowType: 'bench',
        slots: bnSlots.slice(i, i + 4),
        columns: 4
      });
    }
  }

  // 7. IR (IR then IR+, wrap every 4)
  const irTotal = IR + IR_PLUS;
  if (irTotal > 0) {
    const irSlots: RosterSlot[] = [];

    for (let i = 0; i < IR; i++) {
      irSlots.push({
        id: `IR-${i}`,
        type: 'IR',
        index: i,
        displayName: IR === 1 ? 'IR' : `IR ${i + 1}`
      });
    }

    for (let i = 0; i < IR_PLUS; i++) {
      irSlots.push({
        id: `IR+-${i}`,
        type: 'IR+',
        index: i,
        displayName: IR_PLUS === 1 ? 'IR+' : `IR+ ${i + 1}`
      });
    }

    // Chunk into rows of 4
    for (let i = 0; i < irSlots.length; i += 4) {
      rows.push({
        rowType: 'ir',
        slots: irSlots.slice(i, i + 4),
        columns: 4
      });
    }
  }

  return rows;
}

/**
 * Get row type styling classes
 */
export function getRowClasses(rowType: RosterRow['rowType']): string {
  switch (rowType) {
    case 'forwards':
      return 'flex justify-center';
    case 'forward-flex':
    case 'skater-flex':
      return 'flex justify-center';
    case 'defense':
      return 'flex justify-center';
    case 'goalies':
      return 'flex justify-center';
    case 'bench':
    case 'ir':
      return 'flex flex-wrap justify-start';
    default:
      return 'flex justify-start';
  }
}

/**
 * Get row header label
 */
export function getRowLabel(rowType: RosterRow['rowType']): string {
  switch (rowType) {
    case 'forwards':
      return 'Forwards';
    case 'forward-flex':
      return 'Forward Flex';
    case 'skater-flex':
      return 'Utility';
    case 'defense':
      return 'Defense';
    case 'goalies':
      return 'Goalies';
    case 'bench':
      return 'Bench';
    case 'ir':
      return 'Injured Reserve';
    default:
      return '';
  }
}
