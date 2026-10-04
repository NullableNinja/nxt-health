import type { IntegrationProviderId, ProviderCapability } from '../domain/models'

export const providerCapabilities: ProviderCapability[] = [
  {
    provider: 'android-health-connect',
    label: 'Android Health Connect',
    status: 'android-required',
    delivery: 'android',
    auth: 'native-permission',
    reads: [
      'steps',
      'exercise',
      'distance',
      'active calories',
      'weight',
      'body fat',
      'heart rate',
      'resting heart rate',
      'sleep',
    ],
    writes: [],
    requiresCredentials: false,
    requiresApproval: true,
    notes:
      'Requires the Android native client and scoped Health Connect permissions. The web build cannot connect.',
    officialDocsUrl: 'https://developer.android.com/health-and-fitness/health-connect',
  },
]

export function capabilityForProvider(
  provider: IntegrationProviderId,
): ProviderCapability | undefined {
  return providerCapabilities.find((capability) => capability.provider === provider)
}
