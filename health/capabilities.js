export function buildCapabilities({
  databaseReady = false,
  worldDatabaseReady = false,
  contentEngineReady = false,
  operatorTokenConfigured = false,
  socialOperationsReady = false
} = {}) {
  const database = Boolean(databaseReady);
  const socialReady = database && Boolean(socialOperationsReady) && Boolean(operatorTokenConfigured);
  return {
    orderIntake: database,
    contentGeneration: Boolean(contentEngineReady),
    operatorDesk: database && Boolean(operatorTokenConfigured),
    digitalWorldReadApi: database && Boolean(worldDatabaseReady),
    socialWorkspace: socialReady,
    persistentSocialCalendar: socialReady,
    socialAudienceInsights: false,
    payments: false,
    socialOAuth: false,
    cryptoWallet: false,
    personalWallet: false,
    persistentUserAccounts: false,
    automaticPublishing: false,
    liveAssistant: false
  };
}
