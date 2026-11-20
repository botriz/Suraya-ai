export function buildCapabilities({
  databaseReady = false,
  worldDatabaseReady = false,
  contentEngineReady = false,
  operatorTokenConfigured = false
} = {}) {
  const database = Boolean(databaseReady);
  return {
    orderIntake: database,
    contentGeneration: Boolean(contentEngineReady),
    operatorDesk: database && Boolean(operatorTokenConfigured),
    digitalWorldReadApi: database && Boolean(worldDatabaseReady),
    payments: false,
    socialOAuth: false,
    cryptoWallet: false,
    personalWallet: false,
    persistentUserAccounts: false,
    automaticPublishing: false
  };
}
