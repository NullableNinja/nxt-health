import type { HealthMetricKind } from './models'

export type MetricInputType = 'number' | 'percent' | 'paired-number'

export interface MetricDefinition {
  id: HealthMetricKind
  label: string
  domain: 'body' | 'mind' | 'life' | 'spiritual'
  defaultUnit: string
  supportedUnits: string[]
  inputType: MetricInputType
  compound: boolean
  privacySensitive: boolean
  contextFields?: string[]
  validate: (value: number, secondValue?: number) => string | undefined
}

const positive = (value: number) =>
  Number.isFinite(value) && value > 0 ? undefined : 'Enter a value greater than zero.'
const range = (min: number, max: number) => (value: number) =>
  Number.isFinite(value) && value >= min && value <= max
    ? undefined
    : `Enter a value from ${min} to ${max}.`

export const metricRegistry: MetricDefinition[] = [
  {
    id: 'blood-pressure',
    label: 'Blood pressure',
    domain: 'body',
    defaultUnit: 'mmHg',
    supportedUnits: ['mmHg'],
    inputType: 'paired-number',
    compound: true,
    privacySensitive: true,
    validate: (value, secondValue) => positive(value) ?? positive(secondValue ?? 0),
  },
  {
    id: 'waist-circumference',
    label: 'Waist circumference',
    domain: 'body',
    defaultUnit: 'cm',
    supportedUnits: ['cm', 'in'],
    inputType: 'number',
    compound: false,
    privacySensitive: true,
    validate: positive,
  },
  {
    id: 'hip-circumference',
    label: 'Hip circumference',
    domain: 'body',
    defaultUnit: 'cm',
    supportedUnits: ['cm', 'in'],
    inputType: 'number',
    compound: false,
    privacySensitive: true,
    validate: positive,
  },
  {
    id: 'body-fat-percentage',
    label: 'Body fat percentage',
    domain: 'body',
    defaultUnit: '%',
    supportedUnits: ['%'],
    inputType: 'percent',
    compound: false,
    privacySensitive: true,
    validate: range(0, 100),
  },
  {
    id: 'resting-heart-rate',
    label: 'Resting heart rate',
    domain: 'body',
    defaultUnit: 'bpm',
    supportedUnits: ['bpm'],
    inputType: 'number',
    compound: false,
    privacySensitive: true,
    validate: range(20, 250),
  },
  {
    id: 'systolic-blood-pressure',
    label: 'Systolic blood pressure',
    domain: 'body',
    defaultUnit: 'mmHg',
    supportedUnits: ['mmHg'],
    inputType: 'number',
    compound: false,
    privacySensitive: true,
    validate: range(40, 300),
  },
  {
    id: 'diastolic-blood-pressure',
    label: 'Diastolic blood pressure',
    domain: 'body',
    defaultUnit: 'mmHg',
    supportedUnits: ['mmHg'],
    inputType: 'number',
    compound: false,
    privacySensitive: true,
    validate: range(20, 200),
  },
  {
    id: 'fasting-glucose',
    label: 'Fasting glucose',
    domain: 'body',
    defaultUnit: 'mg/dL',
    supportedUnits: ['mg/dL', 'mmol/L'],
    inputType: 'number',
    compound: false,
    privacySensitive: true,
    validate: positive,
  },
  {
    id: 'a1c',
    label: 'A1C',
    domain: 'body',
    defaultUnit: '%',
    supportedUnits: ['%'],
    inputType: 'percent',
    compound: false,
    privacySensitive: true,
    validate: range(0, 30),
  },
  {
    id: 'total-cholesterol',
    label: 'Total cholesterol',
    domain: 'body',
    defaultUnit: 'mg/dL',
    supportedUnits: ['mg/dL', 'mmol/L'],
    inputType: 'number',
    compound: false,
    privacySensitive: true,
    validate: positive,
  },
  {
    id: 'hdl-cholesterol',
    label: 'HDL cholesterol',
    domain: 'body',
    defaultUnit: 'mg/dL',
    supportedUnits: ['mg/dL', 'mmol/L'],
    inputType: 'number',
    compound: false,
    privacySensitive: true,
    validate: positive,
  },
  {
    id: 'ldl-cholesterol',
    label: 'LDL cholesterol',
    domain: 'body',
    defaultUnit: 'mg/dL',
    supportedUnits: ['mg/dL', 'mmol/L'],
    inputType: 'number',
    compound: false,
    privacySensitive: true,
    validate: positive,
  },
  {
    id: 'triglycerides',
    label: 'Triglycerides',
    domain: 'body',
    defaultUnit: 'mg/dL',
    supportedUnits: ['mg/dL', 'mmol/L'],
    inputType: 'number',
    compound: false,
    privacySensitive: true,
    validate: positive,
  },
  {
    id: 'custom',
    label: 'Custom metric',
    domain: 'body',
    defaultUnit: 'unit',
    supportedUnits: ['unit'],
    inputType: 'number',
    compound: false,
    privacySensitive: true,
    contextFields: ['label'],
    validate: positive,
  },
]

export function getMetricDefinition(id: HealthMetricKind): MetricDefinition {
  return metricRegistry.find((metric) => metric.id === id) ?? metricRegistry.at(-1)!
}
