import { getWeekDates } from './dates.js';
import { totalCompletions, computeStreaks, weeklyTarget, weekProgress } from './habits.js';

export const ACHIEVEMENT_DEFS = [
  { id: 'first', icon: '&#127793;', title: 'First Step', desc: 'Complete your first habit', test: (ctx) => ctx.totalDoneAll >= 1 },
  { id: 'streak7', icon: '&#128293;', title: '7-Day Streak', desc: 'Reach a 7-day streak on any habit', test: (ctx) => ctx.maxCurrentStreak >= 7 },
  { id: 'streak30', icon: '&#9889;', title: '30-Day Streak', desc: 'Reach a 30-day streak on any habit', test: (ctx) => ctx.maxCurrentStreak >= 30 },
  { id: 'hundred', icon: '&#128081;', title: 'Century Club', desc: 'Log 100 total completions', test: (ctx) => ctx.totalDoneAll >= 100 },
  { id: 'perfectWeek', icon: '&#127919;', title: 'Perfect Week', desc: 'Hit every target for a full week', test: (ctx) => ctx.hasPerfectWeek },
  { id: 'personalBest', icon: '&#127942;', title: 'New Personal Best', desc: 'Beat your previous longest streak', test: (ctx) => ctx.hasPersonalBest }
];

export function computeAchievementContext(habits) {
  let totalDoneAll = 0, maxCurrentStreak = 0, hasPersonalBest = false;
  habits.forEach(h => {
    totalDoneAll += totalCompletions(h);
    const { current, longest } = computeStreaks(h);
    if (current > maxCurrentStreak) maxCurrentStreak = current;
    if (h._justBeatRecord) hasPersonalBest = true;
    if (longest > 0 && current === longest && (h.longestStreakCache || 0) < longest) hasPersonalBest = true;
  });

  // perfect week: for the current week, every active scheduled habit hit its target
  const weekDates = getWeekDates(0);
  const active = habits.filter(h => !h.archived);
  let hasPerfectWeek = active.length > 0;
  active.forEach(h => {
    const target = weeklyTarget(h);
    const prog = weekProgress(h, weekDates);
    if (prog < target) hasPerfectWeek = false;
  });

  return { totalDoneAll, maxCurrentStreak, hasPersonalBest, hasPerfectWeek };
}

export function getUnlockedAchievements(habits) {
  const ctx = computeAchievementContext(habits);
  return ACHIEVEMENT_DEFS.map(def => ({ ...def, unlocked: !!def.test(ctx) }));
}
