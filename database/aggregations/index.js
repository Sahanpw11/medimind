'use strict';
// Seven pipelines. Each is a plain function returning [collection, pipeline]
// so the API and the standalone runner share exactly the same definitions.
// Operators across the set: $match $group $project $sort $unwind $lookup $facet $bucket $limit.

// A. Appointment volume by doctor (+ name via $lookup)
const volumeByDoctor = () => ['appointments', [
  { $group: { _id: '$doctorId', totalAppointments: { $sum: 1 } } },
  { $sort: { totalAppointments: -1 } },
  { $lookup: { from: 'doctors', localField: '_id', foreignField: '_id', as: 'doctor' } },
  { $unwind: '$doctor' },
  { $project: { _id: 0, doctorId: '$_id', name: '$doctor.name', specialty: '$doctor.specialty', totalAppointments: 1 } },
]];

// B. Appointments joined with doctor specialty (brief example B)
const appointmentsWithSpecialty = ({ limit = 50 } = {}) => ['appointments', [
  { $sort: { startAt: -1 } },
  { $limit: limit },
  { $lookup: { from: 'doctors', localField: 'doctorId', foreignField: '_id', as: 'doctor' } },
  { $unwind: '$doctor' },
  { $project: { patientId: 1, startAt: 1, status: 1, 'doctor.specialty': 1 } },
]];

// C. Monthly trend by status over a date range
const monthlyTrend = ({ from, to }) => ['appointments', [
  { $match: { startAt: { $gte: from, $lt: to } } },
  { $group: { _id: { year: { $year: '$startAt' }, month: { $month: '$startAt' }, status: '$status' }, count: { $sum: 1 } } },
  { $project: { _id: 0, year: '$_id.year', month: '$_id.month', status: '$_id.status', count: 1 } },
  { $sort: { year: 1, month: 1, status: 1 } },
]];

// D. Top diagnoses (clinical, aggregate only — no patient identifiers leave the pipeline)
const topDiagnoses = ({ limit = 10 } = {}) => ['medical_records', [
  { $unwind: '$diagnoses' },
  { $group: { _id: { code: '$diagnoses.code', description: '$diagnoses.description' }, count: { $sum: 1 } } },
  { $sort: { count: -1, '_id.code': 1 } },
  { $limit: limit },
  { $project: { _id: 0, code: '$_id.code', description: '$_id.description', count: 1 } },
]];

// E. Allergy prevalence by substance and severity
const allergyPrevalence = ({ limit = 15 } = {}) => ['patients', [
  { $unwind: '$allergies' },
  { $group: { _id: { substance: '$allergies.substance', severity: '$allergies.severity' }, patients: { $sum: 1 } } },
  { $sort: { patients: -1, '_id.substance': 1 } },
  { $limit: limit },
  { $project: { _id: 0, substance: '$_id.substance', severity: '$_id.severity', patients: 1 } },
]];

// F. Admin overview in one round trip with $facet
const adminOverview = ({ from, to }) => ['appointments', [
  { $match: { startAt: { $gte: from, $lt: to } } },
  { $facet: {
    totals: [{ $group: { _id: null, total: { $sum: 1 }, noShows: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } } } }],
    byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
    bySpecialty: [
      { $lookup: { from: 'doctors', localField: 'doctorId', foreignField: '_id', as: 'd' } },
      { $unwind: '$d' },
      { $group: { _id: '$d.specialty', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ],
    byConsultationType: [{ $group: { _id: '$consultationType', count: { $sum: 1 } } }],
  } },
]];

// G. Patient age bands ($bucket on computed age)
const ageBands = () => ['patients', [
  { $project: { age: { $dateDiff: { startDate: '$dateOfBirth', endDate: '$$NOW', unit: 'year' } } } },
  { $bucket: { groupBy: '$age', boundaries: [0, 18, 35, 50, 65, 200], default: 'unknown', output: { patients: { $sum: 1 } } } },
]];


// H. Doctor dashboard in one round trip: today's agenda, queues, 14-day workload and 90-day outcomes (scoped to one doctor)
const doctorOverview = ({ doctorId, now, dayStart, dayEnd, weekEnd, fortnightEnd, from90 }) => {
  const live = ['booked', 'confirmed'];
  const withPatient = [
    { $lookup: { from: 'patients', localField: 'patientId', foreignField: '_id', as: 'p' } }, { $unwind: '$p' },
    { $project: { patientId: 1, startAt: 1, endAt: 1, status: 1, consultationType: 1, reason: 1, patientName: '$p.fullName' } },
  ];
  return ['appointments', [
    { $match: { doctorId } },
    { $facet: {
      today: [{ $match: { startAt: { $gte: dayStart, $lt: dayEnd }, status: { $in: [...live, 'completed', 'no_show'] } } }, { $sort: { startAt: 1 } }, ...withPatient],
      awaiting: [{ $match: { status: 'booked', startAt: { $gte: now } } }, { $count: 'n' }],
      upcoming7: [{ $match: { status: { $in: live }, startAt: { $gte: now, $lt: weekEnd } } }, { $count: 'n' }],
      daily: [{ $match: { status: { $in: [...live, 'completed'] }, startAt: { $gte: dayStart, $lt: fortnightEnd } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$startAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
      outcomes: [{ $match: { startAt: { $gte: from90, $lt: now } } }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
      next: [{ $match: { status: { $in: live }, startAt: { $gte: now } } }, { $sort: { startAt: 1 } }, { $limit: 1 }, ...withPatient],
      attention: [{ $match: { status: 'booked', startAt: { $gte: now } } }, { $sort: { startAt: 1 } }, { $limit: 5 }, ...withPatient],
    } },
  ]];
};

// I. Patient dashboard: upcoming visits and completed visits per month (scoped to one patient)
const patientOverview = ({ patientId, now, from12 }) => {
  const live = ['booked', 'confirmed'];
  return ['appointments', [
    { $match: { patientId } },
    { $facet: {
      upcoming: [{ $match: { status: { $in: live }, startAt: { $gte: now } } }, { $sort: { startAt: 1 } }, { $limit: 5 },
        { $lookup: { from: 'doctors', localField: 'doctorId', foreignField: '_id', as: 'd' } }, { $unwind: '$d' },
        { $project: { doctorId: 1, startAt: 1, status: 1, consultationType: 1, reason: 1, doctorName: '$d.name', specialty: '$d.specialty' } }],
      upcomingCount: [{ $match: { status: { $in: live }, startAt: { $gte: now } } }, { $count: 'n' }],
      monthly: [{ $match: { status: 'completed', startAt: { $gte: from12, $lt: now } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$startAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
      completed12: [{ $match: { status: 'completed', startAt: { $gte: from12, $lt: now } } }, { $count: 'n' }],
    } },
  ]];
};
// J. Vitals recorded at the patient's most recent visits (oldest to newest)
const patientVitals = ({ patientId, limit = 8 }) => ['medical_records', [
  { $match: { patientId } }, { $sort: { visitAt: -1 } }, { $limit: limit },
  { $project: { _id: 0, visitAt: 1, systolicBP: '$vitals.systolicBP', diastolicBP: '$vitals.diastolicBP', heartRate: '$vitals.heartRate' } },
  { $sort: { visitAt: 1 } },
]];
// K. Clinic operations for the admin: today's activity, backlog, 14-day load, per-doctor booked counts, 90-day outcomes
const clinicOperations = ({ now, dayStart, dayEnd, weekEnd, fortnightEnd, from90 }) => {
  const live = ['booked', 'confirmed'];
  return ['appointments', [
    { $facet: {
      today: [{ $match: { startAt: { $gte: dayStart, $lt: dayEnd }, status: { $in: [...live, 'completed', 'no_show'] } } }, { $sort: { startAt: 1 } },
        { $lookup: { from: 'doctors', localField: 'doctorId', foreignField: '_id', as: 'd' } }, { $unwind: '$d' },
        { $project: { startAt: 1, status: 1, consultationType: 1, doctorName: '$d.name', specialty: '$d.specialty' } }], // no patient details
      unconfirmed7: [{ $match: { status: 'booked', startAt: { $gte: now, $lt: weekEnd } } }, { $count: 'n' }],
      daily: [{ $match: { status: { $in: [...live, 'completed'] }, startAt: { $gte: dayStart, $lt: fortnightEnd } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$startAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
      perDoctor: [{ $match: { status: { $in: live }, startAt: { $gte: dayStart, $lt: fortnightEnd } } }, { $group: { _id: '$doctorId', booked: { $sum: 1 } } }],
      outcomes90: [{ $match: { startAt: { $gte: from90, $lt: now } } }, { $group: { _id: '$status', count: { $sum: 1 } } }],
    } },
  ]];
};

module.exports = {  patientOverview, patientVitals, clinicOperations, doctorOverview, volumeByDoctor, appointmentsWithSpecialty, monthlyTrend, topDiagnoses, allergyPrevalence, adminOverview, ageBands };
