// Database abstraction layer – Supabase backend
// All methods are async and use the Supabase JS client

import { supabase } from './supabase';

export const db = {
    async getAll(collection) {
        const { data, error } = await supabase
            .from(collection)
            .select('*')
            .order('created_at', { ascending: false });
        if (error) { console.error(`getAll ${collection}:`, error); return []; }
        return mapFromDb(collection, data);
    },

    async getById(collection, id) {
        const { data, error } = await supabase
            .from(collection)
            .select('*')
            .eq('id', id)
            .single();
        if (error) { console.error(`getById ${collection}:`, error); return null; }
        return mapRowFromDb(collection, data);
    },

    async add(collection, item) {
        const row = mapToDb(collection, item);
        const { data, error } = await supabase
            .from(collection)
            .insert([row])
            .select()
            .single();
        if (error) { console.error(`add ${collection}:`, error); return null; }
        return mapRowFromDb(collection, data);
    },

    async update(collection, id, updates) {
        const row = mapToDb(collection, updates);
        row.updated_at = new Date().toISOString();
        const { data, error } = await supabase
            .from(collection)
            .update(row)
            .eq('id', id)
            .select()
            .single();
        if (error) { console.error(`update ${collection}:`, error); return null; }
        return mapRowFromDb(collection, data);
    },

    async remove(collection, id) {
        const { error } = await supabase
            .from(collection)
            .delete()
            .eq('id', id);
        if (error) { console.error(`remove ${collection}:`, error); return false; }
        return true;
    },

    async query(collection, filterFn) {
        const all = await this.getAll(collection);
        return all.filter(filterFn);
    },

    async clear(collection) {
        const { error } = await supabase
            .from(collection)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) console.error(`clear ${collection}:`, error);
    },

    async clearAll() {
        await Promise.all([
            this.clear('reworks'),
            this.clear('actions'),
            this.clear('knowledge'),
        ]);
    },

    async count(collection) {
        const { count, error } = await supabase
            .from(collection)
            .select('*', { count: 'exact', head: true });
        if (error) { console.error(`count ${collection}:`, error); return 0; }
        return count || 0;
    },
};

// --- Column mapping helpers (camelCase ↔ snake_case) ---

const COLUMN_MAPS = {
    reworks: {
        toDb: {
            defectType: 'defect_type',
            operatorGroup: 'operator_group',
            materialBatch: 'material_batch',
            suspectedRootCause: 'suspected_root_cause',
            createdAt: 'created_at',
        },
        fromDb: {
            defect_type: 'defectType',
            operator_group: 'operatorGroup',
            material_batch: 'materialBatch',
            suspected_root_cause: 'suspectedRootCause',
            created_at: 'createdAt',
        },
    },
    actions: {
        toDb: {
            defectType: 'defect_type',
            responsiblePerson: 'responsible_person',
            targetDate: 'target_date',
            effectivenessReview: 'effectiveness_review',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        fromDb: {
            defect_type: 'defectType',
            responsible_person: 'responsiblePerson',
            target_date: 'targetDate',
            effectiveness_review: 'effectivenessReview',
            created_at: 'createdAt',
            updated_at: 'updatedAt',
        },
    },
    knowledge: {
        toDb: {
            rootCause: 'root_cause',
            correctiveAction: 'corrective_action',
            beforeResults: 'before_results',
            afterResults: 'after_results',
            defectType: 'defect_type',
            dateClosed: 'date_closed',
            createdAt: 'created_at',
        },
        fromDb: {
            root_cause: 'rootCause',
            corrective_action: 'correctiveAction',
            before_results: 'beforeResults',
            after_results: 'afterResults',
            defect_type: 'defectType',
            date_closed: 'dateClosed',
            created_at: 'createdAt',
        },
    },
};

function mapToDb(collection, obj) {
    const map = COLUMN_MAPS[collection]?.toDb || {};
    const result = {};
    Object.entries(obj).forEach(([key, value]) => {
        // Skip id and undefined values
        if (key === 'id' || value === undefined) return;
        const dbKey = map[key] || key;
        result[dbKey] = value;
    });
    return result;
}

function mapRowFromDb(collection, row) {
    if (!row) return null;
    const map = COLUMN_MAPS[collection]?.fromDb || {};
    const result = {};
    Object.entries(row).forEach(([key, value]) => {
        const jsKey = map[key] || key;
        result[jsKey] = value;
    });
    return result;
}

function mapFromDb(collection, rows) {
    if (!rows) return [];
    return rows.map((row) => mapRowFromDb(collection, row));
}

// --- Role management (still localStorage, purely UI preference) ---

const isBrowser = typeof window !== 'undefined';

export function getRole() {
    if (!isBrowser) return 'Admin';
    return localStorage.getItem('rcis_role') || 'Admin';
}

export function setRole(role) {
    if (!isBrowser) return;
    localStorage.setItem('rcis_role', role);
}

// --- Seed comprehensive demo data into Supabase ---

export async function seedDemoData() {
    const { STATIONS, DEFECT_TYPES, SEVERITY_LEVELS, SHIFTS, OPERATOR_GROUPS, MATERIAL_BATCHES } = require('./constants');

    const now = new Date();
    const daysMs = 86400000;

    // Realistic root causes per defect type
    const ROOT_CAUSES = {
        'Routing Defect': [
            'Operator followed outdated routing card version',
            'Missing route step in traveler document',
            'Incorrect station sequence on work order',
            'Routing change not communicated to shift',
            'Wrong sub-assembly routed to testing',
        ],
        'Crimp Issue': [
            'Crimp die worn beyond tolerance limit',
            'Incorrect crimp height setting after changeover',
            'Terminal not fully seated before crimping',
            'Wrong terminal size selected for wire gauge',
            'Crimp tool calibration expired',
        ],
        'Soldering Defect': [
            'Soldering iron temperature too high causing pad lift',
            'Cold solder joint due to insufficient heat',
            'Flux residue contamination on PCB',
            'Incorrect solder wire diameter used',
            'Operator hand tremor during fine-pitch soldering',
        ],
        'Wiring Error': [
            'Wire connected to wrong terminal position',
            'Wire color code misread under plant lighting',
            'Crossed wires at connector block J4',
            'Missing wire in harness bundle',
            'Wrong wire gauge used for power circuit',
        ],
        'Component Mismatch': [
            'Similar-looking components mixed in feeder bin',
            'Incorrect BOM revision loaded in system',
            'Wrong resistor value placed (10K vs 10R)',
            'Component reel mislabeled by supplier',
            'Substitution component not approved by engineering',
        ],
        'Insulation Failure': [
            'Insulation stripped too far back exposing conductor',
            'Nicked insulation during cable routing',
            'Heat shrink not fully shrunk, exposing splice',
            'Wrong insulation class used for high-temp zone',
            'Mechanical abrasion on sharp chassis edge',
        ],
        'Connector Damage': [
            'Dropped connector on floor during assembly',
            'Excessive insertion force bent contact pins',
            'Connector housing crack from over-tightened screw',
            'Contamination in connector cavity from debris',
            'Wrong orientation forced during blind-mate insertion',
        ],
        'Torque Defect': [
            'Torque wrench not calibrated, reading 20% low',
            'Operator skipped torque verification step',
            'Under-torqued fastener on bus bar connection',
            'Over-torqued screw cracked PCB mount point',
            'Wrong torque spec applied from old revision drawing',
        ],
        'Label Error': [
            'Duplicate serial number printed on label',
            'Wrong product variant code on identification label',
            'Label printer ribbon faded, barcode unreadable',
            'QR code pointing to incorrect document revision',
            'Missing CE marking label on finished unit',
        ],
        'Visual Defect': [
            'Scratch on front panel during handling',
            'Paint chip on enclosure corner',
            'Foreign particle trapped under conformal coating',
            'Misaligned front panel decal',
            'Fingerprint smudge visible under display glass',
        ],
    };

    const REMARKS_POOL = [
        'Caught during in-process inspection',
        'Found at final QC checkpoint',
        'Reported by downstream station operator',
        'Discovered during functional testing',
        'Noticed during visual audit rounds',
        'Flagged by shift supervisor review',
        'Detected by automated vision system',
        'Found during customer witness inspection',
        'Identified after rework from previous station',
        '',
        '',
        '',
    ];

    // ==========================================
    // REWORKS – 150 entries over 90 days
    // ==========================================
    const reworks = [];

    for (let i = 0; i < 150; i++) {
        const daysAgo = Math.floor(Math.random() * 90);
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);

        // Bias patterns for RCIS to detect:
        // 1. Night shift → 65% chance of Routing Defect
        const shift = SHIFTS[Math.random() > 0.45 ? 1 : 0];
        let defect;
        if (shift === 'Night' && Math.random() > 0.35) {
            defect = 'Routing Defect';
        } else {
            defect = DEFECT_TYPES[Math.floor(Math.random() * DEFECT_TYPES.length)];
        }

        // 2. BATCH-2026-003 → spike in Crimp Issues
        const batch = MATERIAL_BATCHES[Math.floor(Math.random() * MATERIAL_BATCHES.length)];
        if (batch === 'BATCH-2026-003' && Math.random() > 0.4) {
            defect = 'Crimp Issue';
        }

        // 3. IGBT station → more Soldering Defects
        let station = STATIONS[Math.floor(Math.random() * STATIONS.length)];
        if (station === 'IGBT' && Math.random() > 0.5) {
            defect = 'Soldering Defect';
        }

        // 4. Recent week surge — more entries from last 7 days for recurrence alerts
        if (daysAgo <= 7 && Math.random() > 0.6) {
            defect = ['Routing Defect', 'Crimp Issue', 'Soldering Defect'][Math.floor(Math.random() * 3)];
        }

        // Severity bias: Routing & Crimp → more High
        let severity;
        if ((defect === 'Routing Defect' || defect === 'Crimp Issue') && Math.random() > 0.5) {
            severity = 'High';
        } else {
            severity = SEVERITY_LEVELS[Math.floor(Math.random() * SEVERITY_LEVELS.length)];
        }

        const rootCauses = ROOT_CAUSES[defect] || ['Under investigation'];
        const rootCause = rootCauses[Math.floor(Math.random() * rootCauses.length)];
        const remark = REMARKS_POOL[Math.floor(Math.random() * REMARKS_POOL.length)];

        reworks.push({
            date: date.toISOString().split('T')[0],
            defect_type: defect,
            station,
            quantity: Math.floor(Math.random() * 6) + 1,
            shift,
            operator_group: OPERATOR_GROUPS[Math.floor(Math.random() * OPERATOR_GROUPS.length)],
            material_batch: batch,
            suspected_root_cause: rootCause,
            severity,
            remarks: remark,
        });
    }

    // Insert in batches of 50 to avoid payload limits
    for (let i = 0; i < reworks.length; i += 50) {
        const batch = reworks.slice(i, i + 50);
        const { error } = await supabase.from('reworks').insert(batch);
        if (error) console.error(`Seed reworks batch ${i}:`, error);
    }

    // ==========================================
    // CORRECTIVE ACTIONS – 10 entries
    // ==========================================
    const actions = [
        {
            defect_type: 'Routing Defect',
            description: 'Retrain all night shift operators on updated routing procedure v3.2',
            responsible_person: 'R. Kumar',
            target_date: new Date(now.getTime() - 5 * daysMs).toISOString().split('T')[0],
            status: 'Closed',
            effectiveness_review: 'Routing defects reduced by 40% after retraining. Night shift compliance at 95%.',
        },
        {
            defect_type: 'Crimp Issue',
            description: 'Replace all worn crimp dies and implement mandatory die inspection at batch changeovers',
            responsible_person: 'S. Patel',
            target_date: new Date(now.getTime() + 3 * daysMs).toISOString().split('T')[0],
            status: 'In Progress',
            effectiveness_review: 'Die replacement 60% complete. New inspection checklist drafted.',
        },
        {
            defect_type: 'Soldering Defect',
            description: 'Calibrate all soldering stations at IGBT and verify temperature profiles weekly',
            responsible_person: 'M. Singh',
            target_date: new Date(now.getTime() - 2 * daysMs).toISOString().split('T')[0],
            status: 'Open',
            effectiveness_review: '',
        },
        {
            defect_type: 'Wiring Error',
            description: 'Update wiring schematics with color-coded diagrams and add poka-yoke connectors',
            responsible_person: 'A. Sharma',
            target_date: new Date(now.getTime() + 10 * daysMs).toISOString().split('T')[0],
            status: 'Open',
            effectiveness_review: '',
        },
        {
            defect_type: 'Component Mismatch',
            description: 'Install barcode verification scanner at Sub Assembly feeder station',
            responsible_person: 'V. Reddy',
            target_date: new Date(now.getTime() - 8 * daysMs).toISOString().split('T')[0],
            status: 'Closed',
            effectiveness_review: 'Zero mismatch defects since scanner installation. ROI achieved in 2 weeks.',
        },
        {
            defect_type: 'Insulation Failure',
            description: 'Add edge protectors on all sharp chassis edges in routing path',
            responsible_person: 'D. Nair',
            target_date: new Date(now.getTime() - 1 * daysMs).toISOString().split('T')[0],
            status: 'In Progress',
            effectiveness_review: 'Protectors installed on 3 of 5 identified edges.',
        },
        {
            defect_type: 'Connector Damage',
            description: 'Provide ESD-safe connector handling trays and training on insertion force limits',
            responsible_person: 'P. Verma',
            target_date: new Date(now.getTime() + 7 * daysMs).toISOString().split('T')[0],
            status: 'Open',
            effectiveness_review: '',
        },
        {
            defect_type: 'Torque Defect',
            description: 'Implement digital torque wrench with automatic data logging and alerts',
            responsible_person: 'K. Mishra',
            target_date: new Date(now.getTime() + 14 * daysMs).toISOString().split('T')[0],
            status: 'Open',
            effectiveness_review: '',
        },
        {
            defect_type: 'Label Error',
            description: 'Upgrade label printer firmware and add automatic serial number validation',
            responsible_person: 'R. Kumar',
            target_date: new Date(now.getTime() - 10 * daysMs).toISOString().split('T')[0],
            status: 'Closed',
            effectiveness_review: 'Duplicate serial labels eliminated. Printer uptime improved to 99.5%.',
        },
        {
            defect_type: 'Routing Defect',
            description: 'Implement digital traveler system to replace paper routing cards',
            responsible_person: 'S. Patel',
            target_date: new Date(now.getTime() + 30 * daysMs).toISOString().split('T')[0],
            status: 'In Progress',
            effectiveness_review: 'Pilot phase on CVS station. Paper routing errors down by 70% on pilot line.',
        },
    ];
    const { error: aErr } = await supabase.from('actions').insert(actions);
    if (aErr) console.error('Seed actions error:', aErr);

    // ==========================================
    // KNOWLEDGE BANK – 6 entries
    // ==========================================
    const knowledge = [
        {
            problem: 'Recurring routing defects on Night Shift at CVS station',
            root_cause: 'Night shift operators were using routing card v2.8 while Day shift had already switched to v3.2. The updated version added a new QC hold point that Night shift was bypassing.',
            corrective_action: 'Conducted targeted retraining for all night shift operators. Implemented digital routing card system that auto-updates. Added shift handover checklist item for routing revision verification.',
            before_results: '12 routing defects/week',
            after_results: '3 routing defects/week',
            station: 'CVS',
            defect_type: 'Routing Defect',
            date_closed: new Date(now.getTime() - 15 * daysMs).toISOString().split('T')[0],
            image: null,
        },
        {
            problem: 'Crimp height failures spiking after BATCH-2026-003 introduction',
            root_cause: 'BATCH-2026-003 terminal supplier changed raw material thickness by 0.05mm without notification. Existing crimp dies were set for previous tolerance band, causing out-of-spec crimp heights.',
            corrective_action: 'Implemented mandatory die inspection and first-article verification at every batch change. Filed supplier corrective action (SCAR). Added incoming material thickness check.',
            before_results: '8 crimp failures/week',
            after_results: '1 crimp failure/week',
            station: 'Loom',
            defect_type: 'Crimp Issue',
            date_closed: new Date(now.getTime() - 30 * daysMs).toISOString().split('T')[0],
            image: null,
        },
        {
            problem: 'Cold solder joints on IGBT power module connections',
            root_cause: 'Soldering station #3 had a faulty thermocouple reading 15°C higher than actual tip temperature. Operators believed they were at 370°C but actual temp was only 355°C, insufficient for lead-free solder.',
            corrective_action: 'Replaced thermocouple on station #3. Implemented weekly calibration checks with contact thermometer. Added visual solder quality reference cards at each station.',
            before_results: '6 solder defects/week',
            after_results: '0.5 solder defects/week',
            station: 'IGBT',
            defect_type: 'Soldering Defect',
            date_closed: new Date(now.getTime() - 45 * daysMs).toISOString().split('T')[0],
            image: null,
        },
        {
            problem: 'Component mismatch at Sub Assembly — wrong resistor values',
            root_cause: 'Similar-looking 10KΩ and 10Ω resistors stored in adjacent bins without visual differentiation. The bin labels were small text only with no color coding. Two instances of wrong values placed in a single week.',
            corrective_action: 'Installed barcode scanner verification at feeder station. Color-coded all component bins. Added pick-to-light system for high-risk similar components. Reorganized bin layout to separate look-alike parts.',
            before_results: '3 mismatches/week',
            after_results: '0 mismatches in 6 weeks',
            station: 'Sub Assembly',
            defect_type: 'Component Mismatch',
            date_closed: new Date(now.getTime() - 20 * daysMs).toISOString().split('T')[0],
            image: null,
        },
        {
            problem: 'Label errors — duplicate serial numbers on finished units',
            root_cause: 'Label printer buffer was retaining previous print job data when network connection dropped momentarily. Upon reconnection, it would reprint the last label instead of advancing to next serial number.',
            corrective_action: 'Updated printer firmware to v4.2 which clears buffer on reconnection. Added serial number uniqueness check in QC scan system that flags duplicates immediately. Installed UPS on printer network switch.',
            before_results: '2 duplicate labels/month',
            after_results: '0 duplicates in 3 months',
            station: 'Testing',
            defect_type: 'Label Error',
            date_closed: new Date(now.getTime() - 10 * daysMs).toISOString().split('T')[0],
            image: null,
        },
        {
            problem: 'Insulation nicks on cables routed through chassis bay 3',
            root_cause: 'Sheet metal edge at chassis bay 3 entry point had a sharp burr from stamping process. Cable bundles rubbing against this edge during vibration testing caused insulation damage detectable only after test.',
            corrective_action: 'Installed rubber grommets and edge protectors at all chassis cable entry/exit points. Added cable routing inspection step before vibration test. Filed engineering change request to deburr all stamped edges.',
            before_results: '4 insulation failures/month',
            after_results: '0 failures in 2 months',
            station: 'CVS',
            defect_type: 'Insulation Failure',
            date_closed: new Date(now.getTime() - 7 * daysMs).toISOString().split('T')[0],
            image: null,
        },
    ];
    const { error: kErr } = await supabase.from('knowledge').insert(knowledge);
    if (kErr) console.error('Seed knowledge error:', kErr);
}
