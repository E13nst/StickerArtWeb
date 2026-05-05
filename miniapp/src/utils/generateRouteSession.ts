/** Сессионные флаги маршрута /generate: без полноценного remount страницы. */

/** После первого успешного снятия лендинг-гейта в этой вкладке — не дергать reset() при каждом возврате на /generate. */
export const GENERATE_LANDING_PRIMED_SESSION_KEY = 'stixly-generate-landing-primed';

/** Последний закреплённый localId истории — восстановить UI при следующем монтировании GeneratePage. */
export const getGenerateResumeLocalIdKey = (userScopeId: string): string =>
  `stixly:generate-resume-local:v1:${userScopeId}`;
