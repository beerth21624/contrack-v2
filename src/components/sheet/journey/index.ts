// Shared building blocks of the guided-journey pages (every level looks and behaves the same).
export { EmptyState, type EmptyAction } from './EmptyState';
export { ResultSummary, blankIfZero, rebarSummaryItem, resultText, type SummaryItem } from './ResultSummary';
export { FromLevel } from './FromLevel';
export { LevelLink, levelHref, levelTitle } from './levelRef';
export { Hint, LabelWithHint } from './Hint';
export { SumInput } from './SumInput';
export { AddButton, ElementCard, JBar, JGroup, JNumber, JSelect, JText } from './Fields';
export { ChoiceButtons, FieldNote, PresetChips, outOfRange } from './Choices';
export { ChecklistItem, ChecklistProgress, type ChecklistValue } from './ChecklistItem';
export { FillBadge, FillProgress, countFill, fillState, fillTone, type FillState } from './FillStatus';
export { PlanCard } from './PlanCard';
export { MissingRing, PlanField, PlanNumber } from './PlanField';
export {
    RequiredArea, RequiredContext, RequiredMark, RequiredScope, useRequiredAdd, useRequiredCard, useRequiredField, type RequiredState,
} from './RequiredContext';
export {
    cardTargetId, fieldTargetId, highlightTargets, missingSummary, targetOf, targetSelectors, NO_TARGETS,
    type HighlightTarget, type HighlightTargets, type RowScope,
} from './required';
export { CountStepper } from './CountStepper';
export { BarField } from './BarField';
export { PlanGroup } from './PlanGroup';
export { insertAfter, nextFreeName, patchAt, removeAt } from './listOps';
export { isPositive, planChecks, type CheckResult, type PlanCheck } from './planChecks';
export { NameInput } from './NameInput';
export { QuickAddChips } from './QuickAdd';
export { SuggestedValue } from './SuggestedValue';
export { nextCopyName } from './copyName';
