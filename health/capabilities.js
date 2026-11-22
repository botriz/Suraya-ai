export function buildCapabilities({
  databaseReady = false,
  worldDatabaseReady = false,
  contentEngineReady = false,
  operatorTokenConfigured = false,
  socialOperationsReady = false,
  socialOAuthReady = false,
  telegramPublishingReady = false,
  sourceGroundedResearchReady = false,
  mediaStorageReady = false
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
    socialAudienceInsights: Boolean(socialOAuthReady) && socialReady,
    sourceGroundedResearch: Boolean(sourceGroundedResearchReady) && socialReady,
    mediaUploads: Boolean(mediaStorageReady) && socialReady,
    socialOAuth: Boolean(socialOAuthReady) && socialReady,
    telegramPublishing: Boolean(telegramPublishingReady) && socialReady,
    payments: false,
    cryptoWallet: false,
    personalWallet: false,
    persistentUserAccounts: false,
    automaticPublishing: false,
    liveAssistant: false
  };
}
