import { STAGES } from './data.js';
import { getDailyGoalProgress, getStageMastery, getWeakItems } from './core.js';
import {
  CONFUSION_ACTIVE_SCORE,
  getTopConfusions,
  getConfusionPairItems,
  getConfusionInsight
} from './confusion-model.js';

const MASTERY_THRESHOLD = 75;

export function getUnlockedItems(progress) {
  return STAGES
    .filter((stage) => stage.number <= (progress.unlockedStage ?? 1))
    .flatMap((stage) => stage.items.map((item) => ({
      ...item,
      stageId: stage.id,
      stageNumber: stage.number,
      stageTitle: stage.title
    })));
}

export function getWeakPreview(progress, limit = 3) {
  const attempted = getUnlockedItems(progress)
    .filter((item) => (progress.itemStats?.[item.id]?.seen ?? 0) > 0);

  if (!attempted.length) return [];
  return getWeakItems(attempted, progress.itemStats ?? {}, Math.min(limit, attempted.length));
}

function recommendedStage(progress) {
  const unlocked = STAGES.filter((stage) => stage.number <= (progress.unlockedStage ?? 1));
  return unlocked.find((stage) => getStageMastery(stage, progress.itemStats ?? {}) < MASTERY_THRESHOLD)
    ?? unlocked.find((stage) => stage.id === progress.lastStageId)
    ?? unlocked.at(-1)
    ?? STAGES[0];
}

function currentStage(progress) {
  const last = STAGES.find((stage) => stage.id === progress.lastStageId && stage.number <= (progress.unlockedStage ?? 1));
  return last ?? recommendedStage(progress);
}

function weakGlyphs(items) {
  return items.map((item) => item.hangul).filter(Boolean).join('・');
}

function confusionAction(pair, { optional = false } = {}) {
  const items = getConfusionPairItems(pair);
  if (!items) return null;
  const insight = getConfusionInsight(items.correct, items.selected);
  return {
    type: optional ? 'bonus-confusion' : 'confusion-review',
    action: 'confusion-start',
    pairKey: pair.key,
    stageId: items.correct.stageId,
    count: 3,
    title: optional ? '今日の5問は完了。' : `${items.correct.hangul}と${items.selected.hangul}を3問だけ。`,
    support: optional
      ? `${items.correct.hangul}と${items.selected.hangul}の${insight.dimension}だけ、もう一度。`
      : `${insight.dimension}の違いを見る。`,
    reason: optional
      ? `続けるなら、最近${pair.recentMistakes ?? pair.totalMistakes ?? 1}回取り違えた組を優先します。`
      : `最近${pair.recentMistakes ?? pair.totalMistakes ?? 1}回取り違えています。`,
    priority: optional ? 92 : 98,
    optional
  };
}

export function getNextLearningAction(progress, { dateKey } = {}) {
  const safeProgress = progress ?? {};
  const daily = getDailyGoalProgress(safeProgress, 5, dateKey);
  const weak = getWeakPreview(safeProgress, 3);
  const weakWrongCount = weak.filter((item) => safeProgress.itemStats?.[item.id]?.lastResult === 'wrong').length;
  const stage = currentStage(safeProgress);
  const stageMastery = getStageMastery(stage, safeProgress.itemStats ?? {});
  const activeConfusion = getTopConfusions(safeProgress, {
    dateKey,
    limit: 1,
    minScore: CONFUSION_ACTIVE_SCORE
  })[0];

  if ((safeProgress.sessionsPlayed ?? 0) === 0) {
    return {
      type: 'first-five',
      action: 'quick-start',
      stageId: STAGES[0].id,
      count: 5,
      title: 'まずは5問だけ。',
      support: '文字の形と読みを、軽く結びつける。',
      reason: '最初は選ばず、基本母音から始めます。',
      priority: 100
    };
  }

  if (!daily.complete && activeConfusion) {
    const action = confusionAction(activeConfusion);
    if (action) return action;
  }

  if (daily.complete) {
    if (activeConfusion) {
      const action = confusionAction(activeConfusion, { optional: true });
      if (action) return action;
    }

    if (weak.length) {
      return {
        type: 'bonus-weak',
        action: 'weak-start',
        stageId: weak[0]?.stageId ?? stage.id,
        count: 8,
        title: '今日の5問は完了。',
        support: `${weakGlyphs(weak)}だけ、もう一度見分ける。`,
        reason: '今日はここで終えてもOK。続けるなら苦手を優先します。',
        priority: 90,
        optional: true
      };
    }

    return {
      type: 'bonus-five',
      action: 'quick-start',
      stageId: stage.id,
      count: 5,
      title: '今日の5問は完了。',
      support: 'もう一周はボーナス。',
      reason: '今日はここで終えてもOKです。',
      priority: 80,
      optional: true
    };
  }

  if (weakWrongCount >= 2) {
    return {
      type: 'weak-review',
      action: 'weak-start',
      stageId: weak[0]?.stageId ?? stage.id,
      count: 8,
      title: '今日は苦手から。',
      support: `${weakGlyphs(weak)}を先に見分け直す。`,
      reason: '直近で間違えた文字を優先しています。',
      priority: 95
    };
  }

  if (stageMastery >= 50 && stageMastery < MASTERY_THRESHOLD) {
    return {
      type: 'finish-stage',
      action: 'quick-start',
      stageId: stage.id,
      count: 5,
      title: `あと少しで「${stage.title}」が定着。`,
      support: '5問だけ続ける。',
      reason: `現在の習熟 ${stageMastery}%・75%が目安です。`,
      priority: 88
    };
  }

  if (safeProgress.lastStageId && stageMastery < MASTERY_THRESHOLD) {
    return {
      type: 'continue-stage',
      action: 'quick-start',
      stageId: stage.id,
      count: 5,
      title: '前回の続きから5問。',
      support: `「${stage.title}」を少し進める。`,
      reason: '前回の学習位置を優先しています。',
      priority: 84
    };
  }

  const next = recommendedStage(safeProgress);
  return {
    type: 'next-stage',
    action: 'quick-start',
    stageId: next.id,
    count: 5,
    title: '次の5問へ。',
    support: `「${next.title}」を進める。`,
    reason: '未定着のステージから自動で選びました。',
    priority: 75
  };
}
